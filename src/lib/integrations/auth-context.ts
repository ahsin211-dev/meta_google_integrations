import { NextRequest } from "next/server";
import { createAnonServerClient } from "@/lib/supabase/server";

export interface RequestAuthContext {
  userId: string;
  workspaceId: string;
  accessToken: string;
}

export async function resolveAuthContext(
  request: NextRequest
): Promise<RequestAuthContext | null> {
  const authHeader = request.headers.get("authorization");
  const workspaceHeader = request.headers.get("x-workspace-id");

  if (!authHeader?.startsWith("Bearer ") || !workspaceHeader) {
    return null;
  }

  const accessToken = authHeader.slice(7);
  const supabase = createAnonServerClient(accessToken);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("workspace_id", workspaceHeader)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return null;
  }

  return {
    userId: user.id,
    workspaceId: workspaceHeader,
    accessToken,
  };
}

/** Dev/test fallback when INTEGRATION_DEV_AUTH is enabled */
export function resolveDevAuthContext(request: NextRequest): RequestAuthContext | null {
  if (process.env.INTEGRATION_DEV_AUTH !== "true") {
    return null;
  }
  const workspaceId = request.headers.get("x-workspace-id");
  const userId = request.headers.get("x-user-id");
  if (!workspaceId || !userId) return null;
  return {
    userId,
    workspaceId,
    accessToken: "dev",
  };
}
