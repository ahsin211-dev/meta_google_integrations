import { NextRequest, NextResponse } from "next/server";
import {
  persistWebhookEvent,
  markWebhookProcessed,
} from "@/lib/integrations/webhooks";
import { captureIntegrationError } from "@/lib/sentry";

export async function POST(request: NextRequest) {
  const channelId = request.headers.get("x-goog-channel-id");
  const resourceId = request.headers.get("x-goog-resource-id");
  const channelToken = request.headers.get("x-goog-channel-token");
  const expectedToken = process.env.GOOGLE_WEBHOOK_CHANNEL_TOKEN;

  if (expectedToken && channelToken !== expectedToken) {
    return NextResponse.json({ error: "invalid_channel_token" }, { status: 401 });
  }

  const idempotencyKey = `${channelId ?? "unknown"}-${resourceId ?? "unknown"}`;

  try {
    const { inserted, id } = await persistWebhookEvent({
      provider: "google",
      idempotencyKey,
      eventType: request.headers.get("x-goog-resource-state") ?? "sync",
      payload: {
        channelId,
        resourceId,
        resourceState: request.headers.get("x-goog-resource-state"),
        messageNumber: request.headers.get("x-goog-message-number"),
      },
    });

    if (!inserted) {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    await markWebhookProcessed(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    captureIntegrationError(error, {
      provider: "google",
      action: "webhook",
    });
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
