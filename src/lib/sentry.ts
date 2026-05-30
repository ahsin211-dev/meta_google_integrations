import * as Sentry from "@sentry/nextjs";
import type { IntegrationProvider } from "./integrations/types";

export function captureIntegrationError(
  error: unknown,
  context: {
    provider: IntegrationProvider;
    action: string;
    workspaceId?: string;
    connectionId?: string;
  }
): void {
  Sentry.withScope((scope) => {
    scope.setTag("integration.provider", context.provider);
    scope.setTag("integration.action", context.action);
    if (context.workspaceId) {
      scope.setTag("workspace.id", context.workspaceId);
    }
    if (context.connectionId) {
      scope.setTag("connection.id", context.connectionId);
    }
    Sentry.captureException(error);
  });
}

export function addIntegrationBreadcrumb(
  message: string,
  data?: Record<string, string>
): void {
  Sentry.addBreadcrumb({
    category: "integration",
    message,
    data,
    level: "info",
  });
}
