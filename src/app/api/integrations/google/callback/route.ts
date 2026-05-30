import { NextRequest } from "next/server";
import { redirectToSettings } from "@/lib/integrations/api-response";
import { handleGoogleCallback } from "@/lib/integrations/google/service";
import { addIntegrationBreadcrumb, captureIntegrationError } from "@/lib/sentry";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");

  if (errorParam) {
    return redirectToSettings("google", {
      status: "error",
      message: errorParam,
    });
  }

  if (!code || !state) {
    return redirectToSettings("google", {
      status: "error",
      message: "missing_code_or_state",
    });
  }

  try {
    addIntegrationBreadcrumb("google.callback", {});
    const result = await handleGoogleCallback({ code, state });
    const base = process.env.APP_URL ?? "http://localhost:3000";
    return Response.redirect(
      `${base}${result.redirectPath}/google?status=success`
    );
  } catch (error) {
    captureIntegrationError(error, {
      provider: "google",
      action: "callback",
    });
    return redirectToSettings("google", {
      status: "error",
      message: "connection_failed",
    });
  }
}
