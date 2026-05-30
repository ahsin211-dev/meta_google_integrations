"use client";

import { useCallback, useEffect, useState } from "react";
import type { IntegrationStatusResponse } from "@/types/integrations";
import { IntegrationCard } from "./IntegrationCard";

export function MetaIntegrationPanel() {
  const [status, setStatus] = useState<IntegrationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/meta/status");
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

  const connect = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(
        `/api/integrations/meta/connect?redirect_after=${encodeURIComponent(
          `${window.location.origin}/settings/integrations`
        )}`
      );
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
      const res = await fetch("/api/integrations/meta/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message ?? "Disconnect failed");
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Disconnect failed");
    } finally {
      setActionLoading(false);
    }
  };

  const connected =
    status && status.connectionStatus !== "revoked" && status.accounts.length > 0;
  const pages = status?.accounts.filter((a) => a.accountType === "facebook_page") ?? [];
  const instagram = status?.accounts.filter((a) => a.accountType === "instagram_business") ?? [];

  return (
    <IntegrationCard
      title="Meta (Facebook & Instagram)"
      description="Connect Facebook Pages and linked Instagram Business accounts."
    >
      {loading && <p className="text-sm text-neutral-500">Loading…</p>}
      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {error}
        </p>
      )}

      {status?.needsReconnect && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This integration needs to be reconnected. Disconnect and connect again, or approve
          missing permissions.
        </div>
      )}

      {status && status.missingScopes.length > 0 && (
        <div className="mb-4 text-sm">
          <p className="font-medium text-neutral-800">Missing permissions</p>
          <ul className="mt-1 list-inside list-disc text-neutral-600">
            {status.missingScopes.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      {connected ? (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">Connected Pages</p>
            <ul className="mt-1 text-sm text-neutral-700">
              {pages.length === 0 ? (
                <li>No pages found</li>
              ) : (
                pages.map((p) => <li key={p.id}>{p.accountName}</li>)
              )}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium">Instagram Business</p>
            <ul className="mt-1 text-sm text-neutral-700">
              {instagram.length === 0 ? (
                <li>No Instagram Business accounts linked</li>
              ) : (
                instagram.map((a) => <li key={a.id}>{a.accountName}</li>)
              )}
            </ul>
          </div>
          {status.lastSync && (
            <p className="text-xs text-neutral-500">
              Last sync: {status.lastSync.action} — {status.lastSync.status} at{" "}
              {new Date(status.lastSync.at).toLocaleString()}
            </p>
          )}
          {status.lastError.message && (
            <p className="text-xs text-red-700">Error: {status.lastError.message}</p>
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
      ) : (
        <button
          type="button"
          onClick={connect}
          disabled={actionLoading}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Connect Meta
        </button>
      )}
    </IntegrationCard>
  );
}
