import { NextRequest, NextResponse } from "next/server";
import { requireMetaConfig } from "@/lib/env";
import { handleRouteError } from "@/lib/api/route-handler";
import { MetaIntegrationService } from "@/services/integrations/meta/meta-integration-service";

export async function GET(request: NextRequest) {
  const config = requireMetaConfig();
  const mode = request.nextUrl.searchParams.get("hub.mode");
  const token = request.nextUrl.searchParams.get("hub.verify_token");
  const challenge = request.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === config.webhookVerifyToken) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-hub-signature-256");
    const payload = JSON.parse(rawBody) as Record<string, unknown>;
    const service = new MetaIntegrationService();
    await service.handleWebhook({ rawBody, signature, payload });
    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    return handleRouteError(error, { provider: "meta", action: "webhook" });
  }
}
