"use client";

import { useCallback, useEffect, useState } from "react";
import type { IntegrationStatusResponse } from "@/types/integrations";
import { IntegrationCard } from "./IntegrationCard";

type GoogleStatus = IntegrationStatusResponse & { modules?: string[] };

export function GoogleIntegrationPanel() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/google/status");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Failed to load status");
      setStatus(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const connect = async (forceConsent = false) => {
    setActionLoading(true);
    try {
      const params = new URLSearchParams({
        modules: "calendar,meet",
        redirect_after: `${window.location.origin}/settings/integrations`,
      });
      if (forceConsent) params.set("force_consent", "true");
      const res = await fetch(`/api/integrations/google/connect?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Connect failed");
      window.location.href = data.authorizationUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connect failed");
      setActionLoading(false);
    }
  };

  const disconnect = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/integrations/google/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Disconnect failed");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setActionLoading(false);
    }
  };

  const connected = status && status.connectionStatus !== "revoked" && status.accountName;

  return (
    <IntegrationCard
      title="Google (Calendar & Meet)"
      description="Connect Google Calendar for scheduling and Meet links. Gmail is optional and disabled by default."
    >
      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {status?.needsReconnect && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Reconnect required — use &quot;Reconnect&quot; to grant offline access again.
        </div>
      )}

      {connected ? (
        <div className="space-y-4">
          <p className="text-sm">
            <span className="font-medium">Account:</span> {status.accountName}
          </p>
          <div className="text-sm">
            <p className="font-medium">Enabled modules</p>
            <ul className="mt-1 list-inside list-disc text-neutral-700">
              {(status.modules ?? ["calendar", "meet"]).map((m) => (
                <li key={m} className="capitalize">
                  {m}
                </li>
              ))}
            </ul>
          </div>
          <div className="text-sm">
            <p className="font-medium">Granted scopes</p>
            <ul className="mt-1 max-h-32 overflow-y-auto text-xs text-neutral-600">
              {status.scopesGranted.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
          {status.missingScopes.length > 0 && (
            <div className="text-sm text-amber-800">
              <p className="font-medium">Missing scopes</p>
              <ul className="list-inside list-disc">
                {status.missingScopes.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {status.lastSync && (
            <p className="text-xs text-neutral-500">
              Last activity: {status.lastSync.action} — {status.lastSync.status}
            </p>
          )}
          <div className="flex gap-2">
            {status.needsReconnect && (
              <button
                type="button"
                onClick={() => connect(true)}
                disabled={actionLoading}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                Reconnect
              </button>
            )}
            <button
              type="button"
              onClick={disconnect}
              disabled={actionLoading}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 disabled:opacity-50"
            >
              Disconnect
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => connect()}
          disabled={actionLoading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Connect Google
        </button>
      )}
    </IntegrationCard>
  );
}
