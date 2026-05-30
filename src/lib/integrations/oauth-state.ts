import { randomBytes, createHash } from "crypto";
import type { IntegrationProvider } from "./types";
import { createServiceRoleClient } from "@/lib/supabase/server";

const STATE_TTL_MS = 15 * 60 * 1000;

export function generateOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function generatePkceVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function pkceChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export async function storeOAuthState(params: {
  workspaceId: string;
  userId: string;
  provider: IntegrationProvider;
  redirectPath?: string;
  codeVerifier?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const state = generateOAuthState();
  const supabase = createServiceRoleClient();
  const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();

  const { error } = await supabase.from("integration_oauth_states").insert({
    state,
    workspace_id: params.workspaceId,
    user_id: params.userId,
    provider: params.provider,
    code_verifier: params.codeVerifier ?? null,
    redirect_path: params.redirectPath ?? "/settings/integrations",
    metadata: params.metadata ?? {},
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`Failed to store OAuth state: ${error.message}`);
  }

  return state;
}

export async function consumeOAuthState(state: string): Promise<{
  workspaceId: string;
  userId: string;
  provider: IntegrationProvider;
  codeVerifier: string | null;
  redirectPath: string;
  metadata: Record<string, unknown>;
}> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("integration_oauth_states")
    .select("*")
    .eq("state", state)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Invalid OAuth state");
  }

  if (new Date(data.expires_at).getTime() < Date.now()) {
    await supabase.from("integration_oauth_states").delete().eq("state", state);
    throw new Error("OAuth state expired");
  }

  await supabase.from("integration_oauth_states").delete().eq("state", state);

  return {
    workspaceId: data.workspace_id,
    userId: data.user_id,
    provider: data.provider,
    codeVerifier: data.code_verifier,
    redirectPath: data.redirect_path ?? "/settings/integrations",
    metadata: (data.metadata as Record<string, unknown>) ?? {},
  };
}
