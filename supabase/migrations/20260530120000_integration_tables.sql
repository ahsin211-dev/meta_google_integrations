-- Integration tables for multi-tenant Meta & Google OAuth
-- Tokens are encrypted at application layer; RLS blocks direct token access from clients.

CREATE TYPE integration_provider AS ENUM ('meta', 'google');
CREATE TYPE integration_connection_status AS ENUM (
  'connected',
  'needs_reconnect',
  'error',
  'revoked'
);

-- Parent connection per workspace + provider (one active OAuth grant)
CREATE TABLE integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  provider integration_provider NOT NULL,
  provider_account_id TEXT,
  account_name TEXT,
  connection_status integration_connection_status NOT NULL DEFAULT 'connected',
  scopes_granted TEXT[] NOT NULL DEFAULT '{}',
  scopes_required TEXT[] NOT NULL DEFAULT '{}',
  last_error_code TEXT,
  last_error_message TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, provider)
);

CREATE INDEX idx_integration_connections_workspace ON integration_connections (workspace_id);
CREATE INDEX idx_integration_connections_provider_account ON integration_connections (provider, provider_account_id);

-- Sub-accounts: Meta Pages, Instagram; Google modules metadata
CREATE TABLE integration_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  connection_id UUID NOT NULL REFERENCES integration_connections (id) ON DELETE CASCADE,
  provider integration_provider NOT NULL,
  provider_account_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'default',
  connection_status integration_connection_status NOT NULL DEFAULT 'connected',
  metadata JSONB NOT NULL DEFAULT '{}',
  scopes_granted TEXT[] NOT NULL DEFAULT '{}',
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (connection_id, provider_account_id)
);

CREATE INDEX idx_integration_accounts_workspace ON integration_accounts (workspace_id);
CREATE INDEX idx_integration_accounts_provider ON integration_accounts (provider, provider_account_id);

-- Encrypted tokens — server-side access only via service role
CREATE TABLE integration_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  connection_id UUID REFERENCES integration_connections (id) ON DELETE CASCADE,
  account_id UUID REFERENCES integration_accounts (id) ON DELETE CASCADE,
  provider integration_provider NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'access',
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (connection_id IS NOT NULL OR account_id IS NOT NULL)
);

CREATE INDEX idx_integration_tokens_connection ON integration_tokens (connection_id);
CREATE INDEX idx_integration_tokens_account ON integration_tokens (account_id);
CREATE INDEX idx_integration_tokens_expires ON integration_tokens (expires_at) WHERE expires_at IS NOT NULL;

-- OAuth CSRF / PKCE sessions (short-lived)
CREATE TABLE integration_oauth_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  user_id UUID NOT NULL,
  provider integration_provider NOT NULL,
  state_hash TEXT NOT NULL UNIQUE,
  code_verifier TEXT,
  redirect_after TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_oauth_sessions_expires ON integration_oauth_sessions (expires_at);

-- Webhook inbox with idempotency
CREATE TABLE integration_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  provider integration_provider NOT NULL,
  idempotency_key TEXT NOT NULL,
  event_type TEXT,
  provider_account_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  processing_status TEXT NOT NULL DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, idempotency_key)
);

CREATE INDEX idx_integration_webhook_events_status ON integration_webhook_events (processing_status, created_at);

-- Audit / sync logs for customer-facing status
CREATE TABLE integration_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  connection_id UUID REFERENCES integration_connections (id) ON DELETE SET NULL,
  account_id UUID REFERENCES integration_accounts (id) ON DELETE SET NULL,
  provider integration_provider NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_integration_sync_logs_workspace ON integration_sync_logs (workspace_id, created_at DESC);

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
ALTER TABLE integration_oauth_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_sync_logs ENABLE ROW LEVEL SECURITY;

-- Helper: workspace_id from JWT (set by Supabase custom claim or app_metadata)
CREATE OR REPLACE FUNCTION auth_workspace_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'workspace_id')::UUID,
    (auth.jwt() -> 'user_metadata' ->> 'workspace_id')::UUID
  );
$$ LANGUAGE sql STABLE;

-- integration_connections: tenant read/write metadata (no tokens here)
CREATE POLICY integration_connections_select ON integration_connections
  FOR SELECT TO authenticated
  USING (workspace_id = auth_workspace_id());

CREATE POLICY integration_connections_insert ON integration_connections
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = auth_workspace_id());

CREATE POLICY integration_connections_update ON integration_connections
  FOR UPDATE TO authenticated
  USING (workspace_id = auth_workspace_id());

CREATE POLICY integration_connections_delete ON integration_connections
  FOR DELETE TO authenticated
  USING (workspace_id = auth_workspace_id());

-- integration_accounts
CREATE POLICY integration_accounts_select ON integration_accounts
  FOR SELECT TO authenticated
  USING (workspace_id = auth_workspace_id());

CREATE POLICY integration_accounts_insert ON integration_accounts
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = auth_workspace_id());

CREATE POLICY integration_accounts_update ON integration_accounts
  FOR UPDATE TO authenticated
  USING (workspace_id = auth_workspace_id());

CREATE POLICY integration_accounts_delete ON integration_accounts
  FOR DELETE TO authenticated
  USING (workspace_id = auth_workspace_id());

-- integration_tokens: NO policies for authenticated — service role only
CREATE POLICY integration_tokens_deny_authenticated ON integration_tokens
  FOR ALL TO authenticated
  USING (false);

-- oauth sessions: deny client direct access
CREATE POLICY integration_oauth_sessions_deny ON integration_oauth_sessions
  FOR ALL TO authenticated
  USING (false);

-- webhook events: read-only metadata for workspace
CREATE POLICY integration_webhook_events_select ON integration_webhook_events
  FOR SELECT TO authenticated
  USING (workspace_id IS NULL OR workspace_id = auth_workspace_id());

-- sync logs
CREATE POLICY integration_sync_logs_select ON integration_sync_logs
  FOR SELECT TO authenticated
  USING (workspace_id = auth_workspace_id());

CREATE POLICY integration_sync_logs_insert ON integration_sync_logs
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id = auth_workspace_id());

-- Service role bypasses RLS by default in Supabase

COMMENT ON TABLE integration_tokens IS 'Encrypted OAuth tokens. Access only via server service role.';
COMMENT ON TABLE integration_connections IS 'Per-workspace provider connection metadata without secrets.';
