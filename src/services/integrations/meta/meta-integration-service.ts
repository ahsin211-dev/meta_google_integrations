import { requireMetaConfig, isFeatureEnabled } from "@/lib/env";
import { verifyMetaWebhookSignature } from "@/lib/integrations/meta-webhook-signature";
import { ProviderError } from "@/lib/errors/provider-errors";
import { signOAuthState, verifyOAuthState, generatePkcePair, hashStateForStorage } from "@/lib/oauth/state";
import { captureIntegrationError, addIntegrationBreadcrumb } from "@/lib/sentry";
import type { IntegrationStatusResponse } from "@/types/integrations";
import { IntegrationRepository } from "../integration-repository";
import {
  buildMetaOAuthUrl,
  exchangeCodeForMetaToken,
  MetaGraphClient,
} from "./meta-graph-client";
import { getMetaOAuthScopes, getMissingScopes, META_REQUIRED_SCOPES } from "./meta-scopes";

export class MetaIntegrationService {
  private repo = new IntegrationRepository();

  assertEnabled(): void {
    if (!isFeatureEnabled("meta")) {
      throw new ProviderError("configuration_error", "Meta integration disabled");
    }
  }

  async startConnect(input: {
    workspaceId: string;
    userId: string;
    redirectAfter?: string;
    includeInstagram?: boolean;
  }): Promise<{ authorizationUrl: string }> {
    this.assertEnabled();
    const config = requireMetaConfig();
    const scopes = getMetaOAuthScopes(input.includeInstagram !== false);
    const nonce = crypto.randomUUID();
    const { codeVerifier, codeChallenge } = generatePkcePair();

    const state = await signOAuthState({
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: "meta",
      nonce,
      redirectAfter: input.redirectAfter,
    });

    await this.repo.saveOAuthSession({
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: "meta",
      stateHash: hashStateForStorage(state),
      codeVerifier,
      redirectAfter: input.redirectAfter,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    addIntegrationBreadcrumb("meta_connect_started", {
      workspaceId: input.workspaceId,
    });

    const authorizationUrl = buildMetaOAuthUrl({
      appId: config.appId,
      redirectUri: config.redirectUri,
      state,
      scopes,
      graphApiVersion: config.graphVersion,
      codeChallenge,
    });

    return { authorizationUrl };
  }

  async handleCallback(input: {
    code?: string;
    state?: string;
    error?: string;
    errorReason?: string;
  }): Promise<{ redirectUrl: string }> {
    this.assertEnabled();

    if (input.error) {
      throw new ProviderError(
        "oauth_denied",
        input.errorReason ?? input.error,
        undefined,
        400
      );
    }
    if (!input.code || !input.state) {
      throw new ProviderError("oauth_invalid_state", "Missing code or state");
    }

    const statePayload = await verifyOAuthState(input.state);
    const session = await this.repo.consumeOAuthSession(hashStateForStorage(input.state));
    if (!session || session.workspaceId !== statePayload.workspaceId) {
      throw new ProviderError("oauth_invalid_state", "OAuth session not found or expired");
    }

    const config = requireMetaConfig();
    const { accessToken: shortToken } = await exchangeCodeForMetaToken({
      code: input.code,
      redirectUri: config.redirectUri,
      appId: config.appId,
      appSecret: config.appSecret,
    });

    const graph = new MetaGraphClient(shortToken);
    const longLived = await graph.exchangeShortLivedToken(config.appId, config.appSecret);
    const longLivedClient = new MetaGraphClient(longLived.access_token);

    const me = await longLivedClient.getMeAccounts();
    const scopes = getMetaOAuthScopes();
    const expiresAt = longLived.expires_in
      ? new Date(Date.now() + longLived.expires_in * 1000)
      : undefined;

    const connection = await this.repo.upsertConnection({
      workspaceId: statePayload.workspaceId,
      provider: "meta",
      providerAccountId: statePayload.userId,
      accountName: "Meta Account",
      scopesGranted: scopes,
      scopesRequired: [...META_REQUIRED_SCOPES],
      createdBy: statePayload.userId,
      connectionStatus: "connected",
    });

    await this.repo.saveToken({
      workspaceId: statePayload.workspaceId,
      connectionId: connection.id,
      provider: "meta",
      tokenType: "user_long_lived",
      accessToken: longLived.access_token,
      expiresAt,
    });

    for (const page of me.data) {
      const account = await this.repo.upsertAccount({
        workspaceId: statePayload.workspaceId,
        connectionId: connection.id,
        provider: "meta",
        providerAccountId: page.id,
        accountName: page.name,
        accountType: "facebook_page",
        metadata: {
          hasInstagram: Boolean(page.instagram_business_account?.id),
        },
      });

      await this.repo.saveToken({
        workspaceId: statePayload.workspaceId,
        accountId: account.id,
        provider: "meta",
        tokenType: "page_access",
        accessToken: page.access_token,
      });

      if (page.instagram_business_account?.id) {
        const igId = page.instagram_business_account.id;
        let igUsername: string | undefined;
        try {
          const ig = await new MetaGraphClient(page.access_token).getInstagramAccount(igId);
          igUsername = ig.username;
        } catch (e) {
          captureIntegrationError(e, {
            provider: "meta",
            workspaceId: statePayload.workspaceId,
            action: "instagram_detection",
          });
        }

        await this.repo.upsertAccount({
          workspaceId: statePayload.workspaceId,
          connectionId: connection.id,
          provider: "meta",
          providerAccountId: igId,
          accountName: igUsername ? `@${igUsername}` : `Instagram ${igId}`,
          accountType: "instagram_business",
          metadata: { linkedPageId: page.id },
        });
      }
    }

    await this.repo.writeSyncLog({
      workspaceId: statePayload.workspaceId,
      connectionId: connection.id,
      provider: "meta",
      action: "connect",
      status: "success",
      message: `Connected ${me.data.length} page(s)`,
      createdBy: statePayload.userId,
    });

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const redirectUrl =
      session.redirectAfter ?? `${base}/settings/integrations?provider=meta&status=connected`;
    return { redirectUrl };
  }

  async getStatus(workspaceId: string): Promise<IntegrationStatusResponse> {
    const connection = await this.repo.getConnection(workspaceId, "meta");
    const lastSync = await this.repo.getLastSyncLog(workspaceId, "meta");

    if (!connection) {
      return {
        provider: "meta",
        connectionStatus: "revoked",
        accountName: null,
        scopesGranted: [],
        scopesRequired: [...META_REQUIRED_SCOPES],
        missingScopes: [...META_REQUIRED_SCOPES],
        accounts: [],
        lastError: { code: null, message: null },
        lastSync: null,
        needsReconnect: false,
      };
    }

    const accounts = await this.repo.listAccounts(connection.id);
    const missingScopes = getMissingScopes(
      connection.scopes_granted,
      connection.scopes_required
    );
    const needsReconnect =
      connection.connection_status === "needs_reconnect" ||
      connection.connection_status === "error" ||
      missingScopes.length > 0;

    return {
      provider: "meta",
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
        ? {
            action: lastSync.action,
            status: lastSync.status,
            at: lastSync.created_at,
          }
        : null,
      needsReconnect,
    };
  }

  async disconnect(workspaceId: string, userId: string): Promise<void> {
    const connection = await this.repo.getConnection(workspaceId, "meta");
    if (!connection) return;

    await this.repo.deleteTokensForConnection(connection.id);
    await this.repo.deleteAccountsForConnection(connection.id);
    await this.repo.updateConnectionStatus(connection.id, "revoked");
    await this.repo.deleteConnection(connection.id);

    await this.repo.writeSyncLog({
      workspaceId,
      provider: "meta",
      action: "disconnect",
      status: "success",
      createdBy: userId,
    });
  }

  verifyWebhookSignature(signature: string | null, rawBody: string, appSecret: string): void {
    verifyMetaWebhookSignature(signature, rawBody, appSecret);
  }

  async handleWebhook(input: {
    rawBody: string;
    signature: string | null;
    payload: Record<string, unknown>;
  }): Promise<void> {
    const config = requireMetaConfig();
    this.verifyWebhookSignature(input.signature, input.rawBody, config.appSecret);

    const entry = (input.payload.entry as Array<Record<string, unknown>>) ?? [];
    for (const item of entry) {
      const pageId = item.id as string;
      const changes = (item.changes as Array<Record<string, unknown>>) ?? [];
      for (const change of changes) {
        const idempotencyKey = `meta:${pageId}:${change.field}:${JSON.stringify(change.value)}`;
        const connection = await this.repo.findConnectionByProviderAccount("meta", pageId);

        const { created, id } = await this.repo.persistWebhookEvent({
          workspaceId: connection?.workspace_id,
          provider: "meta",
          idempotencyKey,
          eventType: String(change.field ?? "unknown"),
          providerAccountId: pageId,
          payload: { change, entry: item },
        });

        if (created) {
          try {
            // Placeholder for async processing queue
            await this.repo.markWebhookProcessed(id, "processed");
          } catch (e) {
            await this.repo.markWebhookProcessed(
              id,
              "failed",
              e instanceof Error ? e.message : "unknown"
            );
            throw e;
          }
        }
      }
    }
  }
}
