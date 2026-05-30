import { createServiceRoleClient } from "@/lib/supabase/server";
import { logIntegrationAction } from "../audit";
import { getMetaScopes, isMetaEnabled } from "../config";
import { ProviderError } from "../errors";
import { upsertToken, deleteTokensForConnection } from "../tokens";
import type { PublicIntegrationStatus } from "../types";
import {
  buildMetaAuthorizeUrl,
  exchangeMetaCode,
  exchangeMetaLongLivedToken,
  fetchMetaMe,
  fetchMetaPages,
} from "./client";
import {
  generatePkceVerifier,
  pkceChallengeFromVerifier,
  storeOAuthState,
} from "../oauth-state";

function requiredMetaEnv() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = process.env.META_REDIRECT_URI;
  if (!appId || !appSecret || !redirectUri) {
    throw new ProviderError({
      code: "provider_error",
      message: "Meta OAuth is not configured",
      customerMessage: "Meta integration is not available. Contact your administrator.",
      httpStatus: 503,
      provider: "meta",
    });
  }
  return { appId, appSecret, redirectUri };
}

export async function startMetaConnect(params: {
  workspaceId: string;
  userId: string;
  redirectPath?: string;
}): Promise<string> {
  if (!isMetaEnabled()) {
    throw new ProviderError({
      code: "feature_disabled",
      message: "Meta integration disabled",
      customerMessage: "Meta integration is currently disabled.",
      httpStatus: 403,
      provider: "meta",
    });
  }

  const { appId, redirectUri } = requiredMetaEnv();
  const usePkce = process.env.META_OAUTH_USE_PKCE === "true";
  const codeVerifier = usePkce ? generatePkceVerifier() : undefined;

  const state = await storeOAuthState({
    workspaceId: params.workspaceId,
    userId: params.userId,
    provider: "meta",
    redirectPath: params.redirectPath,
    codeVerifier,
  });

  return buildMetaAuthorizeUrl({
    appId,
    redirectUri,
    state,
    codeChallenge: codeVerifier
      ? pkceChallengeFromVerifier(codeVerifier)
      : undefined,
  });
}

export async function handleMetaCallback(params: {
  code: string;
  state: string;
}): Promise<{ workspaceId: string; redirectPath: string }> {
  const { consumeOAuthState } = await import("../oauth-state");
  const oauth = await consumeOAuthState(params.state).catch(() => {
    throw new ProviderError({
      code: "invalid_state",
      message: "Invalid OAuth state",
      customerMessage: "Connection session expired. Please try connecting again.",
      httpStatus: 400,
      provider: "meta",
    });
  });

  const { appId, appSecret, redirectUri } = requiredMetaEnv();

  const short = await exchangeMetaCode({
    appId,
    appSecret,
    redirectUri,
    code: params.code,
    codeVerifier: oauth.codeVerifier ?? undefined,
  });

  const longLived = await exchangeMetaLongLivedToken({
    appId,
    appSecret,
    shortLivedToken: short.accessToken,
  });

  const me = await fetchMetaMe(longLived.accessToken);
  const pages = await fetchMetaPages(longLived.accessToken);
  const requiredScopes = getMetaScopes();
  const expiresAt = new Date(Date.now() + longLived.expiresIn * 1000);

  const supabase = createServiceRoleClient();

  const { data: connection, error: connError } = await supabase
    .from("integration_connections")
    .upsert(
      {
        workspace_id: oauth.workspaceId,
        provider: "meta",
        provider_account_id: me.id,
        account_name: me.name,
        connection_status: "connected",
        scopes_granted: requiredScopes,
        scopes_required: requiredScopes,
        last_error_code: null,
        last_error_message: null,
        created_by: oauth.userId,
      },
      { onConflict: "workspace_id,provider,provider_account_id" }
    )
    .select("*")
    .single();

  if (connError || !connection) {
    throw new Error(connError?.message ?? "Failed to save connection");
  }

  await upsertToken({
    workspaceId: oauth.workspaceId,
    provider: "meta",
    connectionId: connection.id,
    tokenType: "user_long_lived",
    accessToken: longLived.accessToken,
    expiresAt,
  });

  for (const page of pages) {
    const { data: account } = await supabase
      .from("integration_accounts")
      .upsert(
        {
          workspace_id: oauth.workspaceId,
          connection_id: connection.id,
          provider: "meta",
          provider_account_id: page.id,
          account_name: page.name,
          account_type: "facebook_page",
          metadata: {},
          connection_status: "connected",
          scopes_granted: requiredScopes,
        },
        { onConflict: "connection_id,provider_account_id" }
      )
      .select("*")
      .single();

    if (account) {
      await upsertToken({
        workspaceId: oauth.workspaceId,
        provider: "meta",
        accountId: account.id,
        tokenType: "page_access",
        accessToken: page.access_token,
      });

      const ig = page.instagram_business_account;
      if (ig?.id) {
        await supabase.from("integration_accounts").upsert(
          {
            workspace_id: oauth.workspaceId,
            connection_id: connection.id,
            provider: "meta",
            provider_account_id: ig.id,
            account_name: `Instagram (${page.name})`,
            account_type: "instagram_business",
            metadata: { linked_page_id: page.id },
            connection_status: "connected",
            scopes_granted: requiredScopes,
          },
          { onConflict: "connection_id,provider_account_id" }
        );
      }
    }
  }

  await logIntegrationAction({
    workspaceId: oauth.workspaceId,
    provider: "meta",
    action: "connect",
    status: "success",
    connectionId: connection.id,
    message: `Connected ${pages.length} page(s)`,
  });

  return { workspaceId: oauth.workspaceId, redirectPath: oauth.redirectPath };
}

export async function getMetaStatus(
  workspaceId: string
): Promise<PublicIntegrationStatus | null> {
  const supabase = createServiceRoleClient();
  const requiredScopes = getMetaScopes();

  const { data: connection } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("provider", "meta")
    .neq("connection_status", "revoked")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!connection) return null;

  const { data: accounts } = await supabase
    .from("integration_accounts")
    .select("*")
    .eq("connection_id", connection.id);

  const granted = connection.scopes_granted ?? [];
  const missingScopes = requiredScopes.filter((s) => !granted.includes(s));

  const { data: lastLog } = await supabase
    .from("integration_sync_logs")
    .select("created_at")
    .eq("connection_id", connection.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    provider: "meta",
    connectionStatus: connection.connection_status,
    accountName: connection.account_name,
    scopesGranted: granted,
    scopesRequired: requiredScopes,
    missingScopes,
    accounts: (accounts ?? []).map((a) => ({
      id: a.id,
      providerAccountId: a.provider_account_id,
      accountName: a.account_name,
      accountType: a.account_type,
      connectionStatus: a.connection_status,
      metadata: (a.metadata as Record<string, unknown>) ?? {},
    })),
    lastErrorCode: connection.last_error_code,
    lastErrorMessage: connection.last_error_message,
    lastSyncAt: lastLog?.created_at ?? null,
  };
}

export async function disconnectMeta(workspaceId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: connections } = await supabase
    .from("integration_connections")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("provider", "meta");

  for (const conn of connections ?? []) {
    await deleteTokensForConnection(conn.id);
    await supabase
      .from("integration_connections")
      .update({ connection_status: "revoked" })
      .eq("id", conn.id);
  }

  await logIntegrationAction({
    workspaceId,
    provider: "meta",
    action: "disconnect",
    status: "success",
  });
}

export async function markMetaNeedsReconnect(
  connectionId: string,
  code: string,
  message: string
): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase
    .from("integration_connections")
    .update({
      connection_status: "needs_reconnect",
      last_error_code: code,
      last_error_message: message,
    })
    .eq("id", connectionId);
}
