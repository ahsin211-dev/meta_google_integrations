import { NextResponse } from "next/server";
import { ProviderError, customerMessageForCode } from "@/lib/errors/provider-errors";
import { captureIntegrationError } from "@/lib/sentry";
import { logger } from "@/lib/logging/logger";

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function handleRouteError(
  error: unknown,
  context?: { provider?: "meta" | "google"; action?: string }
): NextResponse {
  if (error instanceof ProviderError) {
    logger.warn(error.message, {
      provider: context?.provider,
      action: context?.action,
      code: error.code,
    });
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.customerMessage ?? customerMessageForCode(error.code),
        },
      },
      { status: error.httpStatus }
    );
  }

  if (context?.provider) {
    captureIntegrationError(error, {
      provider: context.provider,
      action: context.action,
    });
  }

  logger.error("Unhandled route error", {
    provider: context?.provider,
    action: context?.action,
    message: error instanceof Error ? error.message : "unknown",
  });

  return NextResponse.json(
    {
      error: {
        code: "provider_unknown",
        message: customerMessageForCode("provider_unknown"),
      },
    },
    { status: 500 }
  );
}
