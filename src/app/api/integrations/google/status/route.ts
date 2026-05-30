import { NextRequest, NextResponse } from "next/server";
import {
  resolveAuthContext,
  resolveDevAuthContext,
} from "@/lib/integrations/auth-context";
import { jsonError } from "@/lib/integrations/api-response";
import { getGoogleStatus } from "@/lib/integrations/google/service";

export async function GET(request: NextRequest) {
  try {
    const auth =
      (await resolveAuthContext(request)) ??
      resolveDevAuthContext(request);

    if (!auth) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const status = await getGoogleStatus(auth.workspaceId);
    return NextResponse.json({ connected: !!status, integration: status });
  } catch (error) {
    return jsonError(error);
  }
}
