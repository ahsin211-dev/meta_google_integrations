import { NextRequest, NextResponse } from "next/server";
import {
  resolveAuthContext,
  resolveDevAuthContext,
} from "@/lib/integrations/auth-context";
import { jsonError } from "@/lib/integrations/api-response";
import { setupGoogleWatch } from "@/lib/integrations/google/service";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { captureIntegrationError } from "@/lib/sentry";

export async function POST(request: NextRequest) {
  try {
    const auth =
      (await resolveAuthContext(request)) ??
      resolveDevAuthContext(request);

    if (!auth) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const supabase = createServiceRoleClient();
    const { data: connection } = await supabase
      .from("integration_connections")
      .select("id")
      .eq("workspace_id", auth.workspaceId)
      .eq("provider", "google")
      .eq("connection_status", "connected")
      .maybeSingle();

    if (!connection) {
      return NextResponse.json(
        { error: "not_connected", message: "Connect Google first." },
        { status: 400 }
      );
    }

    const watch = await setupGoogleWatch(auth.workspaceId, connection.id);
    return NextResponse.json({ watch });
  } catch (error) {
    captureIntegrationError(error, {
      provider: "google",
      action: "watch",
    });
    return jsonError(error);
  }
}
