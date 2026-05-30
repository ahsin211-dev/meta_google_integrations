import { NextRequest, NextResponse } from "next/server";
import {
  resolveAuthContext,
  resolveDevAuthContext,
} from "@/lib/integrations/auth-context";
import { jsonError } from "@/lib/integrations/api-response";
import { startMetaConnect } from "@/lib/integrations/meta/service";
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

    addIntegrationBreadcrumb("meta.connect.start", {
      workspaceId: auth.workspaceId,
    });

    const authorizeUrl = await startMetaConnect({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      redirectPath,
    });

    return NextResponse.json({ authorizeUrl });
  } catch (error) {
    captureIntegrationError(error, {
      provider: "meta",
      action: "connect",
    });
    return jsonError(error);
  }
}
