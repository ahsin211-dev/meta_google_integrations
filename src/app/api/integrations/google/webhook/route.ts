import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/route-handler";
import { GoogleIntegrationService } from "@/services/integrations/google/google-integration-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headers: Record<string, string | null> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const service = new GoogleIntegrationService();
    await service.handleWebhook(headers, body);
    return new NextResponse(null, { status: 200 });
  } catch (error) {
    return handleRouteError(error, { provider: "google", action: "webhook" });
  }
}
