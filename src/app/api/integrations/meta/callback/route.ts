import { NextRequest, NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/route-handler";
import { MetaIntegrationService } from "@/services/integrations/meta/meta-integration-service";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const service = new MetaIntegrationService();
    const { redirectUrl } = await service.handleCallback({
      code: params.get("code") ?? undefined,
      state: params.get("state") ?? undefined,
      error: params.get("error") ?? undefined,
      errorReason: params.get("error_reason") ?? undefined,
    });
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return handleRouteError(error, { provider: "meta", action: "callback" });
  }
}
