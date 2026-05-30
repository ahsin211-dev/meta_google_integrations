import { isFeatureEnabled, requireGoogleConfig } from "@/lib/env";
import { ProviderError } from "@/lib/errors/provider-errors";
import { signOAuthState, verifyOAuthState, hashStateForStorage } from "@/lib/oauth/state";
import { addIntegrationBreadcrumb, captureIntegrationError } from "@/lib/sentry";
import type { IntegrationStatusResponse } from "@/types/integrations";
import { IntegrationRepository } from "../integration-repository";
import {
  buildGoogleOAuthUrl,
  exchangeGoogleCode,
  getGoogleUserInfo,
  GoogleCalendarClient,
  refreshGoogleToken,
  revokeGoogleToken,
} from "./google-api-client";
import {
  getGoogleScopesForModules,
  getMissingScopes,
  type GoogleModule,
} from "./google-scopes";

export class GoogleIntegrationService {
  private repo = new IntegrationRepository();

  assertEnabled(): void {
    if (!isFeatureEnabled("google")) {
      throw new ProviderError("configuration_error", "Google integration disabled");
    }
  }

  async startConnect(input: {
    workspaceId: string;
    userId: string;
    modules?: GoogleModule[];
    redirectAfter?: string;
    forceConsent?: boolean;
  }): Promise<{ authorizationUrl: string }> {
    this.assertEnabled();
    const config = requireGoogleConfig();
    const modules = input.modules ?? ["calendar", "meet"];
    const scopes = getGoogleScopesForModules(modules);

    const existing = await this.repo.getConnection(input.workspaceId, "google");
    const needsRefresh = !existing || input.forceConsent;

    const state = await signOAuthState({
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: "google",
      nonce: crypto.randomUUID(),
      redirectAfter: input.redirectAfter,
      modules,
    });

    await this.repo.saveOAuthSession({
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: "google",
      stateHash: hashStateForStorage(state),
      redirectAfter: input.redirectAfter,
      metadata: { modules },
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    addIntegrationBreadcrumb("google_connect_started", { workspaceId: input.workspaceId });

    const authorizationUrl = buildGoogleOAuthUrl({
      clientId: config.clientId,
      redirectUri: config.redirectUri,
      state,
      scopes,
      prompt: needsRefresh ? "consent" : undefined,
      includeGrantedScopes: true,
    });

    return { authorizationUrl };
  }

  async handleCallback(input: {
    code?: string;
    state?: string;
    error?: string;
  }): Promise<{ redirectUrl: string }> {
    this.assertEnabled();
    if (input.error) {
      throw new ProviderError("oauth_denied", input.error);
    }
    if (!input.code || !input.state) {
      throw new ProviderError("oauth_invalid_state", "Missing code or state");
    }

    const statePayload = await verifyOAuthState(input.state);
    const session = await this.repo.consumeOAuthSession(hashStateForStorage(input.state));
    if (!session) {
      throw new ProviderError("oauth_invalid_state", "Session expired");
    }

    const modules = (statePayload.modules ?? ["calendar", "meet"]) as GoogleModule[];
    const config = requireGoogleConfig();
    const tokens = await exchangeGoogleCode({
      code: input.code,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
    });

    if (!tokens.refresh_token) {
      const existingToken = await this.repo.getDecryptedToken({
        connectionId: (
          await this.repo.getConnection(statePayload.workspaceId, "google")
        )?.id,
      });
      if (!existingToken?.refreshToken) {
        await this.repo.writeSyncLog({
          workspaceId: statePayload.workspaceId,
          provider: "google",
          action: "connect",
          status: "warning",
          message: "No refresh token returned; reconnect with consent",
          createdBy: statePayload.userId,
        });
      }
    }

    const userInfo = await getGoogleUserInfo(tokens.access_token);
    const scopesGranted = tokens.scope.split(" ");
    const scopesRequired = getGoogleScopesForModules(modules);

    const connection = await this.repo.upsertConnection({
      workspaceId: statePayload.workspaceId,
      provider: "google",
      providerAccountId: userInfo.sub,
      accountName: userInfo.name ?? userInfo.email,
      scopesGranted,
      scopesRequired,
      createdBy: statePayload.userId,
      connectionStatus: tokens.refresh_token ? "connected" : "needs_reconnect",
      lastErrorCode: tokens.refresh_token ? undefined : "missing_refresh_token",
      lastErrorMessage: tokens.refresh_token
        ? undefined
        : "Reconnect and approve offline access",
    });

    await this.repo.saveToken({
      workspaceId: statePayload.workspaceId,
      connectionId: connection.id,
      provider: "google",
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
    });

    await this.repo.upsertAccount({
      workspaceId: statePayload.workspaceId,
      connectionId: connection.id,
      provider: "google",
      providerAccountId: userInfo.sub,
      accountName: userInfo.email,
      accountType: "google_user",
      metadata: { modules },
      scopesGranted,
    });

    await this.repo.writeSyncLog({
      workspaceId: statePayload.workspaceId,
      connectionId: connection.id,
      provider: "google",
      action: "connect",
      status: "success",
      createdBy: statePayload.userId,
    });

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return {
      redirectUrl:
        session.redirectAfter ?? `${base}/settings/integrations?provider=google&status=connected`,
    };
  }

  async refreshConnectionTokens(workspaceId: string): Promise<void> {
    const connection = await this.repo.getConnection(workspaceId, "google");
    if (!connection) return;

    const stored = await this.repo.getDecryptedToken({ connectionId: connection.id });
    if (!stored?.refreshToken) {
      await this.repo.updateConnectionStatus(connection.id, "needs_reconnect", {
        code: "missing_refresh_token",
        message: "Reconnect Google account",
      });
      return;
    }

    const config = requireGoogleConfig();
    try {
      const refreshed = await refreshGoogleToken({
        refreshToken: stored.refreshToken,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      });
      await this.repo.saveToken({
        workspaceId,
        connectionId: connection.id,
        provider: "google",
        accessToken: refreshed.access_token,
        refreshToken: stored.refreshToken,
        expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
      });
      await this.repo.updateConnectionStatus(connection.id, "connected");
    } catch (e) {
      captureIntegrationError(e, { provider: "google", workspaceId, action: "refresh" });
      await this.repo.updateConnectionStatus(connection.id, "needs_reconnect", {
        code: "token_revoked",
        message: e instanceof Error ? e.message : "refresh failed",
      });
      throw e;
    }
  }

  async getStatus(workspaceId: string): Promise<IntegrationStatusResponse & { modules: string[] }> {
    const connection = await this.repo.getConnection(workspaceId, "google");
    const lastSync = await this.repo.getLastSyncLog(workspaceId, "google");

    if (!connection) {
      return {
        provider: "google",
        connectionStatus: "revoked",
        accountName: null,
        scopesGranted: [],
        scopesRequired: getGoogleScopesForModules(["calendar", "meet"]),
        missingScopes: getGoogleScopesForModules(["calendar", "meet"]),
        accounts: [],
        lastError: { code: null, message: null },
        lastSync: null,
        needsReconnect: false,
        modules: [],
      };
    }

    const accounts = await this.repo.listAccounts(connection.id);
    const missingScopes = getMissingScopes(
      connection.scopes_granted,
      connection.scopes_required
    );
    const modules =
      (accounts[0]?.metadata?.modules as string[] | undefined) ?? ["calendar", "meet"];

    return {
      provider: "google",
      connectionStatus: connection.connection_status,
      accountName: connection.account_name,
      scopesGranted: connection.scopes_granted,
      scopesRequired: connection.scopes_required,
      missingScopes,
      accounts: accounts.map((a) => ({
        id: a.id,
        providerAccountId: a.provider_account_id,
        accountName: a.account_name,
        accountType: a.account_type,
        connectionStatus: a.connection_status,
        metadata: a.metadata,
      })),
      lastError: {
        code: connection.last_error_code,
        message: connection.last_error_message,
      },
      lastSync: lastSync
        ? { action: lastSync.action, status: lastSync.status, at: lastSync.created_at }
        : null,
      needsReconnect:
        connection.connection_status === "needs_reconnect" || missingScopes.length > 0,
      modules,
    };
  }

  async disconnect(workspaceId: string, userId: string): Promise<void> {
    const connection = await this.repo.getConnection(workspaceId, "google");
    if (!connection) return;

    const stored = await this.repo.getDecryptedToken({ connectionId: connection.id });
    if (stored?.accessToken) {
      try {
        await revokeGoogleToken(stored.accessToken);
      } catch (e) {
        captureIntegrationError(e, { provider: "google", workspaceId, action: "revoke" });
      }
    }

    await this.repo.deleteTokensForConnection(connection.id);
    await this.repo.deleteAccountsForConnection(connection.id);
    await this.repo.deleteConnection(connection.id);

    await this.repo.writeSyncLog({
      workspaceId,
      provider: "google",
      action: "disconnect",
      status: "success",
      createdBy: userId,
    });
  }

  async registerCalendarWatch(workspaceId: string): Promise<unknown> {
    const connection = await this.repo.getConnection(workspaceId, "google");
    if (!connection) throw new ProviderError("needs_reconnect", "Not connected");

    await this.refreshConnectionTokens(workspaceId);
    const stored = await this.repo.getDecryptedToken({ connectionId: connection.id });
    if (!stored) throw new ProviderError("needs_reconnect", "No token");

    const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/google/webhook`;
    const client = new GoogleCalendarClient(stored.accessToken);
    return client.registerWatch({
      webhookUrl,
      channelId: `ws-${workspaceId}-${Date.now()}`,
      channelToken: process.env.GOOGLE_WEBHOOK_CHANNEL_TOKEN ?? workspaceId,
    });
  }

  async handleWebhook(headers: Record<string, string | null>, body: string): Promise<void> {
    const channelToken = headers["x-goog-channel-token"];
    const expectedToken = process.env.GOOGLE_WEBHOOK_CHANNEL_TOKEN;
    if (expectedToken && channelToken !== expectedToken) {
      throw new ProviderError("webhook_invalid_signature", "Invalid channel token");
    }
    const channelId = headers["x-goog-channel-id"];
    const resourceState = headers["x-goog-resource-state"];

    const idempotencyKey = `google:${channelId}:${resourceState}:${headers["x-goog-message-number"] ?? "0"}`;

    const { created, id } = await this.repo.persistWebhookEvent({
      provider: "google",
      idempotencyKey,
      eventType: resourceState ?? "sync",
      payload: { channelId, resourceState, body: body.slice(0, 2000) },
    });

    if (created) {
      await this.repo.markWebhookProcessed(id, "processed");
    }
  }
}
