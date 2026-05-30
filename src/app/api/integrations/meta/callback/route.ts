import { NextRequest } from "next/server";
import { redirectToSettings } from "@/lib/integrations/api-response";
import { handleMetaCallback } from "@/lib/integrations/meta/service";
import { addIntegrationBreadcrumb, captureIntegrationError } from "@/lib/sentry";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const errorParam = request.nextUrl.searchParams.get("error");

  if (errorParam) {
    return redirectToSettings("meta", {
      status: "error",
      message: errorParam,
    });
  }

  if (!code || !state) {
    return redirectToSettings("meta", {
      status: "error",
      message: "missing_code_or_state",
    });
  }

  try {
    addIntegrationBreadcrumb("meta.callback", {});
    const result = await handleMetaCallback({ code, state });
    const base = process.env.APP_URL ?? "http://localhost:3000";
    return Response.redirect(
      `${base}${result.redirectPath}/meta?status=success`
    );
  } catch (error) {
    captureIntegrationError(error, {
      provider: "meta",
      action: "callback",
    });
    if (error instanceof Error && error.name === "ProviderError") {
      return redirectToSettings("meta", {
        status: "error",
        message: error.message,
      });
    }
    return redirectToSettings("meta", {
      status: "error",
      message: "connection_failed",
    });
  }
}
