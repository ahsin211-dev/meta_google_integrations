"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicIntegrationStatus } from "@/lib/integrations/types";

interface IntegrationSettingsProps {
  provider: "meta" | "google";
  title: string;
  moduleLabels?: Record<string, string>;
}

export function IntegrationSettings({
  provider,
  title,
  moduleLabels,
}: IntegrationSettingsProps) {
  const [status, setStatus] = useState<PublicIntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);

  const headers = (): HeadersInit => {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (typeof window !== "undefined") {
      const ws = localStorage.getItem("dev_workspace_id");
      const user = localStorage.getItem("dev_user_id");
      if (ws) h["x-workspace-id"] = ws;
      if (user) h["x-user-id"] = user;
    }
    return h;
  };

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/${provider}/status`, {
        headers: headers(),
      });
      const data = await res.json();
      setStatus(data.integration ?? null);
    } finally {
      setLoading(false);
    }
  }, [provider]);

  useEffect(() => {
    loadStatus();
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const s = params.get("status");
      const msg = params.get("message");
      if (s === "success") setBanner("Connected successfully.");
      if (s === "error") setBanner(msg ?? "Connection failed.");
    }
  }, [loadStatus]);

  async function connect(reconnect = false) {
    setActionLoading(true);
    try {
      const qs = reconnect ? "?reconnect=true" : "";
      const res = await fetch(
        `/api/integrations/${provider}/connect${qs}`,
        { headers: headers() }
      );
      const data = await res.json();
      if (data.authorizeUrl) {
        window.location.href = data.authorizeUrl;
      } else {
        setBanner(data.message ?? "Could not start connection.");
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function disconnect() {
    setActionLoading(true);
    try {
      await fetch(`/api/integrations/${provider}/disconnect`, {
        method: "POST",
        headers: headers(),
      });
      setStatus(null);
      setBanner("Disconnected.");
      await loadStatus();
    } finally {
      setActionLoading(false);
    }
  }

  const needsReconnect =
    status?.connectionStatus === "needs_reconnect" ||
    status?.connectionStatus === "error";

  return (
    <div className="integration-panel">
      <header>
        <h1>{title}</h1>
        {banner && (
          <p className={`banner ${banner.includes("success") ? "ok" : "warn"}`}>
            {banner}
          </p>
        )}
      </header>

      {process.env.NODE_ENV === "development" && (
        <section className="dev-auth">
          <p>Dev auth (set localStorage keys):</p>
          <label>
            workspace_id{" "}
            <input
              id="dev-ws"
              defaultValue={
                typeof window !== "undefined"
                  ? localStorage.getItem("dev_workspace_id") ?? ""
                  : ""
              }
              onBlur={(e) =>
                localStorage.setItem("dev_workspace_id", e.target.value)
              }
            />
          </label>
          <label>
            user_id{" "}
            <input
              id="dev-user"
              defaultValue={
                typeof window !== "undefined"
                  ? localStorage.getItem("dev_user_id") ?? ""
                  : ""
              }
              onBlur={(e) =>
                localStorage.setItem("dev_user_id", e.target.value)
              }
            />
          </label>
        </section>
      )}

      {loading ? (
        <p>Loading…</p>
      ) : !status ? (
        <section>
          <p>Not connected.</p>
          <button
            type="button"
            disabled={actionLoading}
            onClick={() => connect(false)}
          >
            Connect
          </button>
        </section>
      ) : (
        <>
          <section className="status-card">
            <p>
              <strong>Status:</strong> {status.connectionStatus}
            </p>
            <p>
              <strong>Account:</strong> {status.accountName ?? "—"}
            </p>
            {needsReconnect && (
              <p className="warn-box">
                Reconnect required
                {status.lastErrorMessage
                  ? `: ${status.lastErrorMessage}`
                  : ""}
              </p>
            )}
            <div className="actions">
              {needsReconnect && (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => connect(true)}
                >
                  Reconnect
                </button>
              )}
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => disconnect()}
              >
                Disconnect
              </button>
            </div>
          </section>

          <section>
            <h2>Granted scopes</h2>
            <ul>
              {status.scopesGranted.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>

          {status.missingScopes.length > 0 && (
            <section>
              <h2>Missing permissions</h2>
              <ul className="missing">
                {status.missingScopes.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2>
              {provider === "meta" ? "Pages & Instagram" : "Modules"}
            </h2>
            {status.accounts.length === 0 ? (
              <p>No linked accounts.</p>
            ) : (
              <ul className="accounts">
                {status.accounts.map((a) => (
                  <li key={a.id}>
                    <strong>{a.accountName ?? a.providerAccountId}</strong>
                    <span className="type">
                      {moduleLabels?.[a.accountType ?? ""] ??
                        a.accountType}
                    </span>
                    <span className={`pill ${a.connectionStatus}`}>
                      {a.connectionStatus}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {status.lastSyncAt && (
            <p className="muted">Last activity: {status.lastSyncAt}</p>
          )}
        </>
      )}

      <style jsx>{`
        .integration-panel {
          max-width: 640px;
          padding: 2rem;
        }
        .status-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 1rem;
          margin: 1rem 0;
        }
        .warn-box {
          color: var(--warn);
          background: rgba(245, 158, 11, 0.1);
          padding: 0.5rem;
          border-radius: 4px;
        }
        .missing li {
          color: var(--warn);
        }
        .accounts li {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          margin-bottom: 0.5rem;
        }
        .type {
          color: var(--muted);
          font-size: 0.85rem;
        }
        .pill {
          font-size: 0.75rem;
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
          background: var(--border);
        }
        .pill.needs_reconnect,
        .pill.error {
          background: rgba(239, 68, 68, 0.2);
          color: var(--error);
        }
        .pill.connected {
          background: rgba(34, 197, 94, 0.2);
          color: var(--success);
        }
        button {
          background: var(--accent);
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          margin-right: 0.5rem;
        }
        button:disabled {
          opacity: 0.6;
        }
        .actions {
          margin-top: 1rem;
        }
        .muted {
          color: var(--muted);
          font-size: 0.9rem;
        }
        .dev-auth {
          font-size: 0.85rem;
          color: var(--muted);
          margin-bottom: 1rem;
        }
        .dev-auth input {
          margin-left: 0.5rem;
          background: var(--surface);
          border: 1px solid var(--border);
          color: var(--text);
          padding: 0.25rem;
        }
      `}</style>
    </div>
  );
}
