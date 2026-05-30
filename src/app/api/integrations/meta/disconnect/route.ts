import { NextRequest, NextResponse } from "next/server";
import {
  resolveAuthContext,
  resolveDevAuthContext,
} from "@/lib/integrations/auth-context";
import { jsonError } from "@/lib/integrations/api-response";
import { disconnectMeta } from "@/lib/integrations/meta/service";
import { captureIntegrationError } from "@/lib/sentry";

export async function POST(request: NextRequest) {
  try {
    const auth =
      (await resolveAuthContext(request)) ??
      resolveDevAuthContext(request);

    if (!auth) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    await disconnectMeta(auth.workspaceId);
    return NextResponse.json({ success: true });
  } catch (error) {
    captureIntegrationError(error, {
      provider: "meta",
      action: "disconnect",
    });
    return jsonError(error);
  }
}
