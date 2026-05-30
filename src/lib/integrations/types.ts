export type IntegrationProvider = "meta" | "google";

export type ConnectionStatus =
  | "connected"
  | "needs_reconnect"
  | "error"
  | "revoked";

export interface IntegrationConnectionRow {
  id: string;
  workspace_id: string;
  provider: IntegrationProvider;
  provider_account_id: string | null;
  account_name: string | null;
  connection_status: ConnectionStatus;
  scopes_granted: string[];
  scopes_required: string[];
  last_error_code: string | null;
  last_error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationAccountRow {
  id: string;
  workspace_id: string;
  connection_id: string;
  provider: IntegrationProvider;
  provider_account_id: string;
  account_name: string | null;
  account_type: string | null;
  metadata: Record<string, unknown>;
  connection_status: ConnectionStatus;
  scopes_granted: string[];
  last_error_code: string | null;
  last_error_message: string | null;
}

export interface PublicIntegrationStatus {
  provider: IntegrationProvider;
  connectionStatus: ConnectionStatus;
  accountName: string | null;
  scopesGranted: string[];
  scopesRequired: string[];
  missingScopes: string[];
  accounts: PublicAccountStatus[];
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  lastSyncAt: string | null;
}

export interface PublicAccountStatus {
  id: string;
  providerAccountId: string;
  accountName: string | null;
  accountType: string | null;
  connectionStatus: ConnectionStatus;
  metadata: Record<string, unknown>;
}
