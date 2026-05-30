import { NextResponse } from "next/server";
import { ProviderError } from "./errors";

export function jsonError(error: unknown): NextResponse {
  if (error instanceof ProviderError) {
    return NextResponse.json(
      {
        error: error.code,
        message: error.customerMessage,
      },
      { status: error.httpStatus }
    );
  }

  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";

  return NextResponse.json(
    { error: "internal_error", message },
    { status: 500 }
  );
}

export function redirectToSettings(
  provider: "meta" | "google",
  params: Record<string, string>
): NextResponse {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const qs = new URLSearchParams(params).toString();
  return NextResponse.redirect(
    `${base}/settings/integrations/${provider}?${qs}`
  );
}
