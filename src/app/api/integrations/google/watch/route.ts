import { requireAuthContext } from "@/lib/auth/session";
import { handleRouteError, jsonOk } from "@/lib/api/route-handler";
import { GoogleIntegrationService } from "@/services/integrations/google/google-integration-service";

export async function POST() {
  try {
    const auth = await requireAuthContext();
    const service = new GoogleIntegrationService();
    const result = await service.registerCalendarWatch(auth.workspaceId);
    return jsonOk({ success: true, watch: result });
  } catch (error) {
    return handleRouteError(error, { provider: "google", action: "watch" });
  }
}
