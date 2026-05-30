import { createServiceRoleClient } from "@/lib/supabase/server";
import { logIntegrationAction } from "../audit";
import {
  getGoogleScopes,
  isGoogleEnabled,
  isGoogleGmailEnabled,
  getAppUrl,
} from "../config";
import { ProviderError } from "../errors";
import {
  getDecryptedAccessToken,
  upsertToken,
  deleteTokensForConnection,
} from "../tokens";
import type { PublicIntegrationStatus } from "../types";
import {
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
  refreshGoogleAccessToken,
  registerCalendarWatch,
} from "./client";
import { storeOAuthState } from "../oauth-state";

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

function requiredGoogleEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new ProviderError({
      code: "provider_error",
      message: "Google OAuth is not configured",
      customerMessage:
        "Google integration is not available. Contact your administrator.",
      httpStatus: 503,
      provider: "google",
    });
  }
  return { clientId, clientSecret, redirectUri };
}

export async function startGoogleConnect(params: {
  workspaceId: string;
  userId: string;
  redirectPath?: string;
  reconnect?: boolean;
}): Promise<string> {
  if (!isGoogleEnabled()) {
    throw new ProviderError({
      code: "feature_disabled",
      message: "Google integration disabled",
      customerMessage: "Google integration is currently disabled.",
      httpStatus: 403,
      provider: "google",
    });
  }

  const { clientId, redirectUri } = requiredGoogleEnv();

  const state = await storeOAuthState({
    workspaceId: params.workspaceId,
    userId: params.userId,
    provider: "google",
    redirectPath: params.redirectPath,
    metadata: { reconnect: params.reconnect ?? false },
  });

  return buildGoogleAuthorizeUrl({
    clientId,
    redirectUri,
    state,
    prompt: params.reconnect ? "consent" : "consent",
  });
}

export async function handleGoogleCallback(params: {
  code: string;
  state: string;
}): Promise<{ workspaceId: string; redirectPath: string }> {
  const { consumeOAuthState } = await import("../oauth-state");
  const oauth = await consumeOAuthState(params.state).catch(() => {
    throw new ProviderError({
      code: "invalid_state",
      message: "Invalid OAuth state",
      customerMessage:
        "Connection session expired. Please try connecting again.",
      httpStatus: 400,
      provider: "google",
    });
  });

  const { clientId, clientSecret, redirectUri } = requiredGoogleEnv();

  const tokens = await exchangeGoogleCode({
    clientId,
    clientSecret,
    redirectUri,
    code: params.code,
  });

  if (!tokens.refreshToken) {
    await logIntegrationAction({
      workspaceId: oauth.workspaceId,
      provider: "google",
      action: "connect",
      status: "error",
      message: "No refresh token returned",
    });
  }

  const user = await fetchGoogleUserInfo(tokens.accessToken);
  const requiredScopes = getGoogleScopes();
  const grantedScopes = tokens.scope.split(" ").filter(Boolean);
  const missingScopes = requiredScopes.filter((s) => !grantedScopes.includes(s));
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

  const connectionStatus =
    !tokens.refreshToken || missingScopes.length > 0
      ? "needs_reconnect"
      : "connected";

  const supabase = createServiceRoleClient();

  const { data: connection, error: connError } = await supabase
    .from("integration_connections")
    .upsert(
      {
        workspace_id: oauth.workspaceId,
        provider: "google",
        provider_account_id: user.id,
        account_name: user.email ?? user.name,
        connection_status: connectionStatus,
        scopes_granted: grantedScopes,
        scopes_required: requiredScopes,
        last_error_code: !tokens.refreshToken ? "missing_refresh_token" : null,
        last_error_message: !tokens.refreshToken
          ? "Reconnect with consent to enable background sync."
          : null,
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
    provider: "google",
    connectionId: connection.id,
    tokenType: "oauth",
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken ?? undefined,
    expiresAt,
  });

  const modules = ["calendar", "meet"];
  if (isGoogleGmailEnabled()) modules.push("gmail");

  for (const mod of modules) {
    await supabase.from("integration_accounts").upsert(
      {
        workspace_id: oauth.workspaceId,
        connection_id: connection.id,
        provider: "google",
        provider_account_id: `${user.id}:${mod}`,
        account_name: user.email,
        account_type: mod,
        metadata: { enabled: true },
        connection_status: connectionStatus,
        scopes_granted: grantedScopes,
      },
      { onConflict: "connection_id,provider_account_id" }
    );
  }

  await logIntegrationAction({
    workspaceId: oauth.workspaceId,
    provider: "google",
    action: "connect",
    status: connectionStatus === "connected" ? "success" : "error",
    connectionId: connection.id,
    message:
      connectionStatus === "connected"
        ? "Google connected"
        : "Connected but requires reconnect for full access",
  });

  return { workspaceId: oauth.workspaceId, redirectPath: oauth.redirectPath };
}

export async function ensureGoogleAccessToken(
  connectionId: string
): Promise<string> {
  const tokenRow = await getDecryptedAccessToken({ connectionId });
  if (!tokenRow) {
    throw new ProviderError({
      code: "refresh_failed",
      message: "No token found",
      customerMessage: "Google is not connected. Please connect your account.",
      httpStatus: 401,
      provider: "google",
    });
  }

  const needsRefresh =
    !tokenRow.expiresAt ||
    tokenRow.expiresAt.getTime() - Date.now() < REFRESH_BUFFER_MS;

  if (!needsRefresh) {
    return tokenRow.accessToken;
  }

  if (!tokenRow.refreshToken) {
    const supabase = createServiceRoleClient();
    await supabase
      .from("integration_connections")
      .update({
        connection_status: "needs_reconnect",
        last_error_code: "missing_refresh_token",
        last_error_message: "Reconnect to restore background access.",
      })
      .eq("id", connectionId);

    throw new ProviderError({
      code: "refresh_failed",
      message: "Missing refresh token",
      customerMessage:
        "Google needs to be reconnected to restore access.",
      httpStatus: 401,
      provider: "google",
    });
  }

  const { clientId, clientSecret } = requiredGoogleEnv();
  const refreshed = await refreshGoogleAccessToken({
    clientId,
    clientSecret,
    refreshToken: tokenRow.refreshToken,
  });

  const supabase = createServiceRoleClient();
  const { data: conn } = await supabase
    .from("integration_connections")
    .select("workspace_id")
    .eq("id", connectionId)
    .single();

  if (!conn) throw new Error("Connection not found");

  await upsertToken({
    workspaceId: conn.workspace_id,
    provider: "google",
    connectionId,
    tokenType: "oauth",
    accessToken: refreshed.accessToken,
    refreshToken: tokenRow.refreshToken,
    expiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
  });

  return refreshed.accessToken;
}

export async function getGoogleStatus(
  workspaceId: string
): Promise<PublicIntegrationStatus | null> {
  const supabase = createServiceRoleClient();
  const requiredScopes = getGoogleScopes();

  const { data: connection } = await supabase
    .from("integration_connections")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("provider", "google")
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
    provider: "google",
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

export async function disconnectGoogle(workspaceId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: connections } = await supabase
    .from("integration_connections")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("provider", "google");

  for (const conn of connections ?? []) {
    await deleteTokensForConnection(conn.id);
    await supabase
      .from("integration_connections")
      .update({ connection_status: "revoked" })
      .eq("id", conn.id);
  }

  await logIntegrationAction({
    workspaceId,
    provider: "google",
    action: "disconnect",
    status: "success",
  });
}

export async function setupGoogleWatch(
  workspaceId: string,
  connectionId: string
): Promise<{ resourceId: string; expiration: string }> {
  const accessToken = await ensureGoogleAccessToken(connectionId);
  const webhookUrl = `${getAppUrl()}/api/integrations/google/webhook`;
  const channelId = `crm-${workspaceId}-${Date.now()}`;
  const channelToken = process.env.GOOGLE_WEBHOOK_CHANNEL_TOKEN ?? "";

  return registerCalendarWatch({
    accessToken,
    webhookUrl,
    channelId,
    channelToken,
  });
}
