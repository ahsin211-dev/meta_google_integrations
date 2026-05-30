import { NextRequest, NextResponse } from "next/server";
import {
  persistWebhookEvent,
  markWebhookProcessed,
  verifyMetaWebhookSignature,
} from "@/lib/integrations/webhooks";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { captureIntegrationError } from "@/lib/sentry";

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");
  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (
    mode === "subscribe" &&
    token &&
    verifyToken &&
    token === verifyToken &&
    challenge
  ) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "verification_failed" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const appSecret = process.env.META_APP_SECRET;

  if (appSecret && !verifyMetaWebhookSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const entry = (payload.entry as Array<{ id?: string }>)?.[0];
  const idempotencyKey =
    request.headers.get("x-hub-delivery-id") ??
    `${entry?.id ?? "unknown"}-${Date.now()}`;

  try {
    const { inserted, id } = await persistWebhookEvent({
      provider: "meta",
      idempotencyKey,
      eventType: "meta_webhook",
      payload,
    });

    if (!inserted) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    const supabase = createServiceRoleClient();
    if (entry?.id) {
      const { data: account } = await supabase
        .from("integration_accounts")
        .select("workspace_id")
        .eq("provider", "meta")
        .eq("provider_account_id", entry.id)
        .maybeSingle();

      if (account?.workspace_id) {
        await supabase
          .from("integration_webhook_events")
          .update({ workspace_id: account.workspace_id })
          .eq("id", id);
      }
    }

    await markWebhookProcessed(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    captureIntegrationError(error, {
      provider: "meta",
      action: "webhook",
    });
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
