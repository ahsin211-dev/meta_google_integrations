import { NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/api/route-handler";
import { MetaIntegrationService } from "@/services/integrations/meta/meta-integration-service";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const redirectAfter = request.nextUrl.searchParams.get("redirect_after") ?? undefined;
    const service = new MetaIntegrationService();
    const { authorizationUrl } = await service.startConnect({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      redirectAfter,
    });
    return jsonOk({ authorizationUrl });
  } catch (error) {
    return handleRouteError(error, { provider: "meta", action: "connect" });
  }
}
