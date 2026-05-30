import { NextRequest, NextResponse } from "next/server";
import {
  resolveAuthContext,
  resolveDevAuthContext,
} from "@/lib/integrations/auth-context";
import { jsonError } from "@/lib/integrations/api-response";
import { startGoogleConnect } from "@/lib/integrations/google/service";
import { addIntegrationBreadcrumb, captureIntegrationError } from "@/lib/sentry";

export async function GET(request: NextRequest) {
  try {
    const auth =
      (await resolveAuthContext(request)) ??
      resolveDevAuthContext(request);

    if (!auth) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const redirectPath =
      request.nextUrl.searchParams.get("redirect_path") ?? undefined;
    const reconnect =
      request.nextUrl.searchParams.get("reconnect") === "true";

    addIntegrationBreadcrumb("google.connect.start", {
      workspaceId: auth.workspaceId,
    });

    const authorizeUrl = await startGoogleConnect({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      redirectPath,
      reconnect,
    });

    return NextResponse.json({ authorizeUrl });
  } catch (error) {
    captureIntegrationError(error, {
      provider: "google",
      action: "connect",
    });
    return jsonError(error);
  }
}
