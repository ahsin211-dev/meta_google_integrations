import { NextRequest } from "next/server";
import { requireAuthContext } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/api/route-handler";
import { GoogleIntegrationService } from "@/services/integrations/google/google-integration-service";
import type { GoogleModule } from "@/services/integrations/google/google-scopes";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const params = request.nextUrl.searchParams;
    const modulesParam = params.get("modules");
    const modules = modulesParam
      ? (modulesParam.split(",") as GoogleModule[])
      : undefined;
    const forceConsent = params.get("force_consent") === "true";

    const service = new GoogleIntegrationService();
    const { authorizationUrl } = await service.startConnect({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      modules,
      redirectAfter: params.get("redirect_after") ?? undefined,
      forceConsent,
    });
    return jsonOk({ authorizationUrl });
  } catch (error) {
    return handleRouteError(error, { provider: "google", action: "connect" });
  }
}
