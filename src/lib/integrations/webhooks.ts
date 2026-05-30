import { createHmac, timingSafeEqual } from "crypto";
import type { IntegrationProvider } from "./types";
import { createServiceRoleClient } from "@/lib/supabase/server";

export async function persistWebhookEvent(params: {
  provider: IntegrationProvider;
  idempotencyKey: string;
  workspaceId?: string;
  eventType?: string;
  payload: Record<string, unknown>;
}): Promise<{ inserted: boolean; id: string }> {
  const supabase = createServiceRoleClient();

  const { data, error } = await supabase
    .from("integration_webhook_events")
    .insert({
      provider: params.provider,
      idempotency_key: params.idempotencyKey,
      workspace_id: params.workspaceId ?? null,
      event_type: params.eventType ?? null,
      payload: params.payload,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("integration_webhook_events")
        .select("id, processed_at")
        .eq("provider", params.provider)
        .eq("idempotency_key", params.idempotencyKey)
        .single();
      return { inserted: false, id: existing?.id ?? "" };
    }
    throw new Error(error.message);
  }

  return { inserted: true, id: data.id };
}

export async function markWebhookProcessed(
  eventId: string,
  errorMessage?: string
): Promise<void> {
  const supabase = createServiceRoleClient();
  await supabase
    .from("integration_webhook_events")
    .update({
      processed_at: new Date().toISOString(),
      error_message: errorMessage ?? null,
    })
    .eq("id", eventId);
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }
  const expected = createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(received, "hex")
    );
  } catch {
    return false;
  }
}
