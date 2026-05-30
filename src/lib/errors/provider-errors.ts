export type ProviderErrorCode =
  | "oauth_invalid_state"
  | "oauth_denied"
  | "missing_scopes"
  | "token_expired"
  | "token_revoked"
  | "needs_reconnect"
  | "app_review_required"
  | "verification_required"
  | "quota_exceeded"
  | "page_disconnected"
  | "webhook_invalid_signature"
  | "provider_unknown"
  | "configuration_error";

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly customerMessage?: string,
    public readonly httpStatus = 400,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export function customerMessageForCode(code: ProviderErrorCode): string {
  const messages: Record<ProviderErrorCode, string> = {
    oauth_invalid_state: "Your connection session expired. Please try connecting again.",
    oauth_denied: "Access was denied. Please approve the requested permissions to connect.",
    missing_scopes: "Some required permissions were not granted. Reconnect and approve all requested access.",
    token_expired: "Your connection expired. Please reconnect your account.",
    token_revoked: "Access was revoked. Please reconnect your account.",
    needs_reconnect: "This integration needs to be reconnected.",
    app_review_required:
      "This feature requires additional app approval from Meta. Contact your workspace admin.",
    verification_required:
      "Google requires additional verification for this feature. Contact your workspace admin.",
    quota_exceeded: "The provider rate limit was reached. Please try again later.",
    page_disconnected: "A connected Page was removed or you no longer have access.",
    webhook_invalid_signature: "Webhook verification failed.",
    provider_unknown: "An unexpected error occurred with the integration provider.",
    configuration_error: "This integration is not configured. Contact support.",
  };
  return messages[code] ?? messages.provider_unknown;
}

export function normalizeMetaGraphError(body: unknown): ProviderError {
  const err = body as { error?: { message?: string; code?: number; type?: string } };
  const message = err?.error?.message ?? "Meta API error";
  const code = err?.error?.code;

  if (code === 190) {
    return new ProviderError("token_expired", message, customerMessageForCode("token_expired"), 401);
  }
  if (code === 10 || err?.error?.type === "OAuthException") {
    return new ProviderError(
      "missing_scopes",
      message,
      customerMessageForCode("missing_scopes")
    );
  }
  if (code === 200) {
    return new ProviderError(
      "app_review_required",
      message,
      customerMessageForCode("app_review_required"),
      403
    );
  }
  return new ProviderError("provider_unknown", message);
}

export function normalizeGoogleError(status: number, body: unknown): ProviderError {
  const err = body as { error?: string; error_description?: string };
  const message = err?.error_description ?? err?.error ?? "Google API error";

  if (err?.error === "invalid_grant") {
    return new ProviderError("token_revoked", message, customerMessageForCode("needs_reconnect"), 401);
  }
  if (status === 429) {
    return new ProviderError("quota_exceeded", message, customerMessageForCode("quota_exceeded"), 429);
  }
  if (status === 403) {
    return new ProviderError(
      "verification_required",
      message,
      customerMessageForCode("verification_required"),
      403
    );
  }
  return new ProviderError("provider_unknown", message);
}
