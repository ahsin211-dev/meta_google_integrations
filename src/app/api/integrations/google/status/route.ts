import { requireAuthContext } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/api/route-handler";
import { GoogleIntegrationService } from "@/services/integrations/google/google-integration-service";

export async function GET() {
  try {
    const auth = await requireAuthContext();
    const service = new GoogleIntegrationService();
    const status = await service.getStatus(auth.workspaceId);
    return jsonOk(status);
  } catch (error) {
    return handleRouteError(error, { provider: "google", action: "status" });
  }
}
