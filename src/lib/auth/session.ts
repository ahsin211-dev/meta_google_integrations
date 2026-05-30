import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProviderError } from "@/lib/errors/provider-errors";

export interface AuthContext {
  userId: string;
  workspaceId: string;
  email?: string;
}

export async function requireAuthContext(): Promise<AuthContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ProviderError("oauth_invalid_state", "Unauthorized", "Please sign in to continue.", 401);
  }

  const workspaceId =
    (user.app_metadata?.workspace_id as string | undefined) ??
    (user.user_metadata?.workspace_id as string | undefined);

  if (!workspaceId) {
    throw new ProviderError(
      "configuration_error",
      "No workspace_id on user",
      "Your account is not assigned to a workspace.",
      403
    );
  }

  return {
    userId: user.id,
    workspaceId,
    email: user.email,
  };
}
