import type { IntegrationProvider } from "./types";
import { encryptToken, decryptToken } from "./crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function upsertToken(params: {
  workspaceId: string;
  provider: IntegrationProvider;
  connectionId?: string;
  accountId?: string;
  tokenType?: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
}): Promise<string> {
  const supabase = createServiceRoleClient();

  const row = {
    workspace_id: params.workspaceId,
    connection_id: params.connectionId ?? null,
    account_id: params.accountId ?? null,
    provider: params.provider,
    token_type: params.tokenType ?? "access",
    access_token_ciphertext: encryptToken(params.accessToken),
    refresh_token_ciphertext: params.refreshToken
      ? encryptToken(params.refreshToken)
      : null,
    expires_at: params.expiresAt?.toISOString() ?? null,
    last_refreshed_at: new Date().toISOString(),
  };

  const filter = params.accountId
    ? { account_id: params.accountId, token_type: row.token_type }
    : { connection_id: params.connectionId, token_type: row.token_type };

  const { data: existing } = await supabase
    .from("integration_tokens")
    .select("id")
    .match(filter)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("integration_tokens")
      .update(row)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return existing.id;
  }

  const { data, error } = await supabase
    .from("integration_tokens")
    .insert(row)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

export async function getDecryptedAccessToken(params: {
  connectionId?: string;
  accountId?: string;
  tokenType?: string;
}): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  tokenId: string;
} | null> {
  const supabase = createServiceRoleClient();
  const query = supabase.from("integration_tokens").select("*");

  if (params.accountId) {
    query.eq("account_id", params.accountId);
  } else if (params.connectionId) {
    query.eq("connection_id", params.connectionId);
  } else {
    return null;
  }

  if (params.tokenType) {
    query.eq("token_type", params.tokenType);
  }

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;

  return {
    accessToken: decryptToken(data.access_token_ciphertext),
    refreshToken: data.refresh_token_ciphertext
      ? decryptToken(data.refresh_token_ciphertext)
      : null,
    expiresAt: data.expires_at ? new Date(data.expires_at) : null,
    tokenId: data.id,
  };
}

export async function deleteTokensForConnection(connectionId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  const { data: accounts } = await supabase
    .from("integration_accounts")
    .select("id")
    .eq("connection_id", connectionId);

  const accountIds = accounts?.map((a) => a.id) ?? [];
  if (accountIds.length > 0) {
    await supabase
      .from("integration_tokens")
      .delete()
      .in("account_id", accountIds);
  }

  await supabase
    .from("integration_tokens")
    .delete()
    .eq("connection_id", connectionId);
}
