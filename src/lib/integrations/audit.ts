import type { IntegrationProvider } from "./types";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function logIntegrationAction(params: {
  workspaceId: string;
  provider: IntegrationProvider;
  action: string;
  status: "success" | "error" | "info";
  message?: string;
  connectionId?: string;
  accountId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase.from("integration_sync_logs").insert({
    workspace_id: params.workspaceId,
    connection_id: params.connectionId ?? null,
    account_id: params.accountId ?? null,
    provider: params.provider,
    action: params.action,
    status: params.status,
    message: params.message ?? null,
    metadata: params.metadata ?? {},
  });
}
