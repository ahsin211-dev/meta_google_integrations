import { requireAuthContext } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/api/route-handler";
import { MetaIntegrationService } from "@/services/integrations/meta/meta-integration-service";

export async function GET() {
  try {
    const auth = await requireAuthContext();
    const service = new MetaIntegrationService();
    const status = await service.getStatus(auth.workspaceId);
    return jsonOk(status);
  } catch (error) {
    return handleRouteError(error, { provider: "meta", action: "status" });
  }
}
