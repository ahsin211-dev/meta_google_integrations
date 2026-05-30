import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/route-handler";
import { GoogleIntegrationService } from "@/services/integrations/google/google-integration-service";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const service = new GoogleIntegrationService();
    const { redirectUrl } = await service.handleCallback({
      code: params.get("code") ?? undefined,
      state: params.get("state") ?? undefined,
      error: params.get("error") ?? undefined,
    });
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return handleRouteError(error, { provider: "google", action: "callback" });
  }
}
