export type ProviderErrorCode =
  | "invalid_state"
  | "missing_scopes"
  | "token_expired"
  | "refresh_failed"
  | "permission_denied"
  | "app_review_required"
  | "quota_exceeded"
  | "webhook_invalid"
  | "provider_error"
  | "feature_disabled";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly customerMessage: string;
  readonly httpStatus: number;
  readonly provider?: string;

  constructor(opts: {
    code: ProviderErrorCode;
    message: string;
    customerMessage: string;
    httpStatus?: number;
    provider?: string;
    cause?: unknown;
  }) {
    super(opts.message, { cause: opts.cause });
    this.name = "ProviderError";
    this.code = opts.code;
    this.customerMessage = opts.customerMessage;
    this.httpStatus = opts.httpStatus ?? 400;
    this.provider = opts.provider;
  }
}

export function normalizeMetaGraphError(body: unknown): ProviderError {
  const err = body as { error?: { message?: string; code?: number; type?: string } };
  const code = err?.error?.code;
  const message = err?.error?.message ?? "Meta API error";

  if (code === 190) {
    return new ProviderError({
      code: "token_expired",
      message,
      customerMessage:
        "Your Meta connection expired. Please reconnect your account.",
      httpStatus: 401,
      provider: "meta",
    });
  }
  if (code === 200 || code === 10) {
    return new ProviderError({
      code: "permission_denied",
      message,
      customerMessage:
        "Missing permissions for this Page. Reconnect and grant all requested permissions.",
      httpStatus: 403,
      provider: "meta",
    });
  }
  if (code === 4 || code === 17) {
    return new ProviderError({
      code: "quota_exceeded",
      message,
      customerMessage: "Meta rate limit reached. Please try again shortly.",
      httpStatus: 429,
      provider: "meta",
    });
  }

  return new ProviderError({
    code: "provider_error",
    message,
    customerMessage:
      "We could not complete the Meta request. Contact support if this continues.",
    httpStatus: 502,
    provider: "meta",
  });
}

export function normalizeGoogleError(status: number, body: unknown): ProviderError {
  const err = body as { error?: string; error_description?: string };
  const message = err?.error_description ?? err?.error ?? "Google API error";

  if (status === 401 || err?.error === "invalid_grant") {
    return new ProviderError({
      code: "refresh_failed",
      message,
      customerMessage:
        "Google access was revoked or expired. Please reconnect your account.",
      httpStatus: 401,
      provider: "google",
    });
  }
  if (status === 403) {
    return new ProviderError({
      code: "permission_denied",
      message,
      customerMessage:
        "Google denied access. Ensure all required scopes are granted.",
      httpStatus: 403,
      provider: "google",
    });
  }
  if (status === 429) {
    return new ProviderError({
      code: "quota_exceeded",
      message,
      customerMessage: "Google API quota exceeded. Try again later.",
      httpStatus: 429,
      provider: "google",
    });
  }

  return new ProviderError({
    code: "provider_error",
    message,
    customerMessage:
      "We could not complete the Google request. Contact support if this continues.",
    httpStatus: 502,
    provider: "google",
  });
}
