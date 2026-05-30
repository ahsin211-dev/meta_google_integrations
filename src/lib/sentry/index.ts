import * as Sentry from "@sentry/nextjs";

export function captureIntegrationError(
  error: unknown,
  context: {
    provider: "meta" | "google";
    workspaceId?: string;
    action?: string;
    extra?: Record<string, unknown>;
  }
): void {
  Sentry.withScope((scope) => {
    scope.setTag("integration.provider", context.provider);
    if (context.workspaceId) scope.setTag("integration.workspace_id", context.workspaceId);
    if (context.action) scope.setTag("integration.action", context.action);
    scope.addBreadcrumb({
      category: "integration",
      message: context.action ?? "integration_error",
      level: "error",
      data: {
        provider: context.provider,
        workspaceId: context.workspaceId,
        ...context.extra,
      },
    });
    Sentry.captureException(error);
  });
}

export function addIntegrationBreadcrumb(
  message: string,
  data: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    category: "integration",
    message,
    level: "info",
    data,
  });
}
