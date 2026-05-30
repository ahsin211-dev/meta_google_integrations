import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { encryptToken, decryptToken } from "@/lib/crypto/token-encryption";
import { logger } from "@/lib/logging/logger";
import type {
  ConnectionStatus,
  IntegrationAccountRow,
  IntegrationConnectionRow,
  IntegrationProvider,
} from "@/types/integrations";

export class IntegrationRepository {
  private db = createSupabaseServiceClient();

  async upsertConnection(input: {
    workspaceId: string;
    provider: IntegrationProvider;
    providerAccountId?: string;
    accountName?: string;
    connectionStatus?: ConnectionStatus;
    scopesGranted: string[];
    scopesRequired: string[];
    createdBy: string;
    lastErrorCode?: string;
    lastErrorMessage?: string;
  }): Promise<IntegrationConnectionRow> {
    const { data, error } = await this.db
      .from("integration_connections")
      .upsert(
        {
          workspace_id: input.workspaceId,
          provider: input.provider,
          provider_account_id: input.providerAccountId ?? null,
          account_name: input.accountName ?? null,
          connection_status: input.connectionStatus ?? "connected",
          scopes_granted: input.scopesGranted,
          scopes_required: input.scopesRequired,
          created_by: input.createdBy,
          last_error_code: input.lastErrorCode ?? null,
          last_error_message: input.lastErrorMessage ?? null,
        },
        { onConflict: "workspace_id,provider" }
      )
      .select()
      .single();

    if (error) throw error;
    return data as IntegrationConnectionRow;
  }

  async getConnection(
    workspaceId: string,
    provider: IntegrationProvider
  ): Promise<IntegrationConnectionRow | null> {
    const { data, error } = await this.db
      .from("integration_connections")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("provider", provider)
      .maybeSingle();
    if (error) throw error;
    return data as IntegrationConnectionRow | null;
  }

  async updateConnectionStatus(
    connectionId: string,
    status: ConnectionStatus,
    lastError?: { code?: string; message?: string }
  ): Promise<void> {
    const { error } = await this.db
      .from("integration_connections")
      .update({
        connection_status: status,
        last_error_code: lastError?.code ?? null,
        last_error_message: lastError?.message ?? null,
      })
      .eq("id", connectionId);
    if (error) throw error;
  }

  async upsertAccount(input: {
    workspaceId: string;
    connectionId: string;
    provider: IntegrationProvider;
    providerAccountId: string;
    accountName: string;
    accountType: string;
    connectionStatus?: ConnectionStatus;
    metadata?: Record<string, unknown>;
    scopesGranted?: string[];
  }): Promise<IntegrationAccountRow> {
    const { data, error } = await this.db
      .from("integration_accounts")
      .upsert(
        {
          workspace_id: input.workspaceId,
          connection_id: input.connectionId,
          provider: input.provider,
          provider_account_id: input.providerAccountId,
          account_name: input.accountName,
          account_type: input.accountType,
          connection_status: input.connectionStatus ?? "connected",
          metadata: input.metadata ?? {},
          scopes_granted: input.scopesGranted ?? [],
        },
        { onConflict: "connection_id,provider_account_id" }
      )
      .select()
      .single();
    if (error) throw error;
    return data as IntegrationAccountRow;
  }

  async listAccounts(connectionId: string): Promise<IntegrationAccountRow[]> {
    const { data, error } = await this.db
      .from("integration_accounts")
      .select("*")
      .eq("connection_id", connectionId);
    if (error) throw error;
    return (data ?? []) as IntegrationAccountRow[];
  }

  async saveToken(input: {
    workspaceId: string;
    connectionId?: string;
    accountId?: string;
    provider: IntegrationProvider;
    tokenType?: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: Date;
  }): Promise<void> {
    const row = {
      workspace_id: input.workspaceId,
      connection_id: input.connectionId ?? null,
      account_id: input.accountId ?? null,
      provider: input.provider,
      token_type: input.tokenType ?? "access",
      encrypted_access_token: encryptToken(input.accessToken),
      encrypted_refresh_token: input.refreshToken ? encryptToken(input.refreshToken) : null,
      expires_at: input.expiresAt?.toISOString() ?? null,
      last_refreshed_at: new Date().toISOString(),
    };

    const filter = input.accountId
      ? { column: "account_id", value: input.accountId }
      : { column: "connection_id", value: input.connectionId! };

    const { data: existing } = await this.db
      .from("integration_tokens")
      .select("id")
      .eq(filter.column, filter.value)
      .eq("token_type", row.token_type)
      .maybeSingle();

    if (existing?.id) {
      const { error } = await this.db.from("integration_tokens").update(row).eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await this.db.from("integration_tokens").insert(row);
      if (error) throw error;
    }
  }

  async getDecryptedToken(input: {
    connectionId?: string;
    accountId?: string;
    tokenType?: string;
  }): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date } | null> {
    let query = this.db.from("integration_tokens").select("*");
    if (input.accountId) query = query.eq("account_id", input.accountId);
    else if (input.connectionId) query = query.eq("connection_id", input.connectionId);
    else return null;

    query = query.eq("token_type", input.tokenType ?? "access");

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return {
      accessToken: decryptToken(data.encrypted_access_token),
      refreshToken: data.encrypted_refresh_token
        ? decryptToken(data.encrypted_refresh_token)
        : undefined,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
    };
  }

  async deleteTokensForConnection(connectionId: string): Promise<void> {
    await this.db.from("integration_tokens").delete().eq("connection_id", connectionId);
  }

  async deleteAccountsForConnection(connectionId: string): Promise<void> {
    await this.db.from("integration_accounts").delete().eq("connection_id", connectionId);
  }

  async deleteConnection(connectionId: string): Promise<void> {
    const { error } = await this.db.from("integration_connections").delete().eq("id", connectionId);
    if (error) throw error;
  }

  async saveOAuthSession(input: {
    workspaceId: string;
    userId: string;
    provider: IntegrationProvider;
    stateHash: string;
    codeVerifier?: string;
    redirectAfter?: string;
    metadata?: Record<string, unknown>;
    expiresAt: Date;
  }): Promise<void> {
    const { error } = await this.db.from("integration_oauth_sessions").insert({
      workspace_id: input.workspaceId,
      user_id: input.userId,
      provider: input.provider,
      state_hash: input.stateHash,
      code_verifier: input.codeVerifier ?? null,
      redirect_after: input.redirectAfter ?? null,
      metadata: input.metadata ?? {},
      expires_at: input.expiresAt.toISOString(),
    });
    if (error) throw error;
  }

  async consumeOAuthSession(stateHash: string): Promise<{
    workspaceId: string;
    userId: string;
    provider: IntegrationProvider;
    codeVerifier: string | null;
    redirectAfter: string | null;
    metadata: Record<string, unknown>;
  } | null> {
    const { data, error } = await this.db
      .from("integration_oauth_sessions")
      .select("*")
      .eq("state_hash", stateHash)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    await this.db.from("integration_oauth_sessions").delete().eq("id", data.id);

    return {
      workspaceId: data.workspace_id,
      userId: data.user_id,
      provider: data.provider,
      codeVerifier: data.code_verifier,
      redirectAfter: data.redirect_after,
      metadata: (data.metadata ?? {}) as Record<string, unknown>,
    };
  }

  async persistWebhookEvent(input: {
    workspaceId?: string;
    provider: IntegrationProvider;
    idempotencyKey: string;
    eventType?: string;
    providerAccountId?: string;
    payload: Record<string, unknown>;
  }): Promise<{ created: boolean; id: string }> {
    const { data, error } = await this.db
      .from("integration_webhook_events")
      .insert({
        workspace_id: input.workspaceId ?? null,
        provider: input.provider,
        idempotency_key: input.idempotencyKey,
        event_type: input.eventType ?? null,
        provider_account_id: input.providerAccountId ?? null,
        payload: input.payload,
        processing_status: "pending",
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: existing } = await this.db
          .from("integration_webhook_events")
          .select("id")
          .eq("provider", input.provider)
          .eq("idempotency_key", input.idempotencyKey)
          .single();
        return { created: false, id: existing!.id as string };
      }
      throw error;
    }
    return { created: true, id: data.id as string };
  }

  async markWebhookProcessed(id: string, status: "processed" | "failed", errorMessage?: string) {
    await this.db
      .from("integration_webhook_events")
      .update({
        processing_status: status,
        processed_at: new Date().toISOString(),
        error_message: errorMessage ?? null,
      })
      .eq("id", id);
  }

  async writeSyncLog(input: {
    workspaceId: string;
    connectionId?: string;
    accountId?: string;
    provider: IntegrationProvider;
    action: string;
    status: string;
    message?: string;
    metadata?: Record<string, unknown>;
    createdBy?: string;
  }): Promise<void> {
    const { error } = await this.db.from("integration_sync_logs").insert({
      workspace_id: input.workspaceId,
      connection_id: input.connectionId ?? null,
      account_id: input.accountId ?? null,
      provider: input.provider,
      action: input.action,
      status: input.status,
      message: input.message ?? null,
      metadata: input.metadata ?? {},
      created_by: input.createdBy ?? null,
    });
    if (error) {
      logger.warn("Failed to write sync log", { provider: input.provider, action: input.action });
    }
  }

  async getLastSyncLog(workspaceId: string, provider: IntegrationProvider) {
    const { data } = await this.db
      .from("integration_sync_logs")
      .select("action, status, created_at")
      .eq("workspace_id", workspaceId)
      .eq("provider", provider)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }

  async findConnectionByProviderAccount(
    provider: IntegrationProvider,
    providerAccountId: string
  ): Promise<IntegrationConnectionRow | null> {
    const { data } = await this.db
      .from("integration_connections")
      .select("*")
      .eq("provider", provider)
      .eq("provider_account_id", providerAccountId)
      .maybeSingle();
    return data as IntegrationConnectionRow | null;
  }
}
