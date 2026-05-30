-- Integration schema for multi-tenant Meta & Google connections
-- Tokens are server-only: RLS policies never expose ciphertext to anon/authenticated SELECT on tokens table.

CREATE TYPE integration_provider AS ENUM ('meta', 'google');
CREATE TYPE integration_connection_status AS ENUM (
  'connected',
  'needs_reconnect',
  'error',
  'revoked'
);

-- Parent connection per workspace + provider (+ optional provider user)
CREATE TABLE integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  provider integration_provider NOT NULL,
  provider_account_id TEXT,
  account_name TEXT,
  connection_status integration_connection_status NOT NULL DEFAULT 'connected',
  scopes_granted TEXT[] DEFAULT '{}',
  scopes_required TEXT[] DEFAULT '{}',
  last_error_code TEXT,
  last_error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider, provider_account_id)
);

CREATE INDEX idx_integration_connections_workspace
  ON integration_connections (workspace_id);

-- Sub-accounts (Meta pages, Instagram, Google modules)
CREATE TABLE integration_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES integration_connections (id) ON DELETE CASCADE,
  provider integration_provider NOT NULL,
  provider_account_id TEXT NOT NULL,
  account_name TEXT,
  account_type TEXT,
  metadata JSONB DEFAULT '{}',
  connection_status integration_connection_status NOT NULL DEFAULT 'connected',
  scopes_granted TEXT[] DEFAULT '{}',
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, provider_account_id)
);

CREATE INDEX idx_integration_accounts_workspace
  ON integration_accounts (workspace_id);

CREATE INDEX idx_integration_accounts_provider_id
  ON integration_accounts (provider, provider_account_id);

-- Encrypted tokens (service role only in application layer)
CREATE TABLE integration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  connection_id UUID REFERENCES integration_connections (id) ON DELETE CASCADE,
  account_id UUID REFERENCES integration_accounts (id) ON DELETE CASCADE,
  provider integration_provider NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'access',
  access_token_ciphertext TEXT NOT NULL,
  refresh_token_ciphertext TEXT,
  expires_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT integration_tokens_target_check CHECK (
    connection_id IS NOT NULL OR account_id IS NOT NULL
  )
);

CREATE INDEX idx_integration_tokens_connection ON integration_tokens (connection_id);
CREATE INDEX idx_integration_tokens_account ON integration_tokens (account_id);
CREATE INDEX idx_integration_tokens_expires ON integration_tokens (expires_at);

-- OAuth state (short-lived, server-managed)
CREATE TABLE integration_oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state TEXT NOT NULL UNIQUE,
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  provider integration_provider NOT NULL,
  code_verifier TEXT,
  redirect_path TEXT,
  metadata JSONB DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_oauth_states_expires ON integration_oauth_states (expires_at);

-- Webhook events (idempotent)
CREATE TABLE integration_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  provider integration_provider NOT NULL,
  idempotency_key TEXT NOT NULL,
  event_type TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, idempotency_key)
);

CREATE INDEX idx_integration_webhook_events_workspace
  ON integration_webhook_events (workspace_id);

-- Sync / audit logs
CREATE TABLE integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  connection_id UUID REFERENCES integration_connections (id) ON DELETE SET NULL,
  account_id UUID REFERENCES integration_accounts (id) ON DELETE SET NULL,
  provider integration_provider NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_sync_logs_workspace
  ON integration_sync_logs (workspace_id, created_at DESC);

-- updated_at triggers
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER integration_connections_updated_at
  BEFORE UPDATE ON integration_connections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER integration_accounts_updated_at
  BEFORE UPDATE ON integration_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER integration_tokens_updated_at
  BEFORE UPDATE ON integration_tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;

-- workspace_members assumed to exist in host CRM; stub policy uses auth.uid() membership
CREATE OR REPLACE FUNCTION user_workspace_ids()
RETURNS SETOF UUID AS $$
  SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Connections: metadata visible to workspace members
CREATE POLICY integration_connections_select ON integration_connections
  FOR SELECT USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY integration_connections_insert ON integration_connections
  FOR INSERT WITH CHECK (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY integration_connections_update ON integration_connections
  FOR UPDATE USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY integration_connections_delete ON integration_connections
  FOR DELETE USING (workspace_id IN (SELECT user_workspace_ids()));

-- Accounts
CREATE POLICY integration_accounts_select ON integration_accounts
  FOR SELECT USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY integration_accounts_insert ON integration_accounts
  FOR INSERT WITH CHECK (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY integration_accounts_update ON integration_accounts
  FOR UPDATE USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY integration_accounts_delete ON integration_accounts
  FOR DELETE USING (workspace_id IN (SELECT user_workspace_ids()));

-- Tokens: NO client access — deny all for authenticated/anon roles
-- Application uses service role for token reads/writes only.
CREATE POLICY integration_tokens_deny_all ON integration_tokens
  FOR ALL USING (false);

-- OAuth states: deny client direct access
CREATE POLICY integration_oauth_states_deny_all ON integration_oauth_states
  FOR ALL USING (false);

-- Webhook events: workspace members can read their events (no raw secrets in payload policy enforced in app)
CREATE POLICY integration_webhook_events_select ON integration_webhook_events
  FOR SELECT USING (
    workspace_id IS NULL OR workspace_id IN (SELECT user_workspace_ids())
  );

-- Sync logs
CREATE POLICY integration_sync_logs_select ON integration_sync_logs
  FOR SELECT USING (workspace_id IN (SELECT user_workspace_ids()));

CREATE POLICY integration_sync_logs_insert ON integration_sync_logs
  FOR INSERT WITH CHECK (workspace_id IN (SELECT user_workspace_ids()));

-- Stub workspace_members for local dev (remove when merging into main CRM)
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member',
  PRIMARY KEY (workspace_id, user_id)
);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_members_self ON workspace_members
  FOR SELECT USING (user_id = auth.uid());
