# Integrations Audit — Meta & Google

**Audit date:** 2026-05-30  
**Mode:** Audit-first (pre-implementation baseline)  
**Repository:** `meta_google_integrations`

---

## Executive summary

This repository was **greenfield** at audit time: no React/Next.js application, Supabase migrations, OAuth routes, webhook handlers, or integration UI existed. Only a placeholder `README.md` was present.

This document records the **baseline (none)**, **target architecture**, **risks**, and a **phased implementation plan** aligned with production SaaS requirements: minimal scopes, server-only tokens, multi-tenant isolation, app-review readiness, and customer-facing status surfaces.

---

## 1. Current Meta integration flow

| Area | Status |
|------|--------|
| OAuth connect (`/api/integrations/meta/connect`) | **Not implemented** |
| OAuth callback (`/api/integrations/meta/callback`) | **Not implemented** |
| Status / disconnect | **Not implemented** |
| Webhooks (`/api/integrations/meta/webhook`) | **Not implemented** |
| Page token / long-lived token exchange | **Not implemented** |
| Instagram Business detection | **Not implemented** |
| Settings UI | **Not implemented** |

**Intended flow (to build):**

1. Authenticated user opens Integrations → Meta → Connect.
2. `GET /api/integrations/meta/connect` creates signed OAuth `state` (workspace_id, user_id, nonce, expiry), stores PKCE verifier server-side, redirects to Facebook Login with minimal page/IG scopes.
3. `GET /api/integrations/meta/callback` validates `state`, exchanges code for short-lived user token, exchanges for long-lived user token, fetches `/me/accounts`, persists pages in `integration_accounts`, stores encrypted page access tokens in `integration_tokens`.
4. For each page, Graph API checks linked Instagram Business account; metadata stored on account row.
5. `POST /api/integrations/meta/webhook` verifies `X-Hub-Signature-256`, dedupes via idempotency key, persists to `integration_webhook_events`, processes async-safe.
6. Status endpoint aggregates connection health, missing scopes, `needs_reconnect` when token invalid/expired.

---

## 2. Current Google integration flow

| Area | Status |
|------|--------|
| OAuth connect / callback | **Not implemented** |
| Status / disconnect | **Not implemented** |
| Calendar / Meet / Gmail modules | **Not implemented** |
| Watch + webhook (`/watch`, `/webhook`) | **Not implemented** |
| Refresh token rotation | **Not implemented** |
| Settings UI | **Not implemented** |

**Intended flow (to build):**

1. `GET /api/integrations/google/connect` builds OAuth URL with `access_type=offline`, `prompt=consent` only when refresh token missing, incremental scopes per enabled modules.
2. Callback stores encrypted refresh + access tokens, scopes on `integration_connections` / `integration_tokens`.
3. Background / on-demand refresh before `expires_at`; mark `needs_reconnect` if refresh fails with `invalid_grant`.
4. Optional Calendar watch registration via `/api/integrations/google/watch`.
5. Webhook receives push notifications; persists and processes with idempotency.

---

## 3. OAuth redirect / callback issues

| Risk | Baseline | Mitigation (implemented in this PR) |
|------|----------|-------------------------------------|
| Open redirect via `redirect_uri` | N/A | Fixed redirect URIs from env only |
| CSRF on callback | N/A | Signed `state` + server-stored OAuth session |
| Missing `state` validation | N/A | Reject callback if state invalid/expired |
| HTTP callback in production | N/A | Enforce HTTPS in production env check |
| Wrong tenant attribution | N/A | `workspace_id` embedded in signed state |
| PKCE bypass | N/A | PKCE for Meta (public client pattern) |

---

## 4. Scope problems

### Meta (recommended minimal set)

| Scope | Purpose |
|-------|---------|
| `pages_show_list` | List Pages user manages |
| `pages_read_engagement` | Read Page engagement (adjust per product) |
| `pages_manage_metadata` | Webhook subscriptions / metadata |
| `instagram_basic` | IG Business profile (if IG required) |
| `instagram_manage_insights` | IG insights (only if product needs it) |

**Risks:** Requesting `ads_management`, `business_management`, or user profile scopes without justification delays Meta App Review.

### Google (recommended modular scopes)

| Scope | Module | Verification |
|-------|--------|----------------|
| `openid`, `email`, `profile` | Identity | Low |
| `https://www.googleapis.com/auth/calendar` | Calendar + Meet | Sensitive |
| `https://www.googleapis.com/auth/calendar.events` | Events (if split) | Sensitive |
| `https://www.googleapis.com/auth/gmail.readonly` | Gmail | **Restricted** — avoid unless required |

**Risks:** Enabling Gmail by default triggers restricted scope verification. Use feature flags and incremental auth.

---

## 5. Token storage / refresh problems

| Issue | Baseline | Target |
|-------|----------|--------|
| Tokens in frontend | None | Never expose; API returns metadata only |
| Plaintext DB storage | None | AES-256-GCM via `INTEGRATION_TOKEN_ENCRYPTION_KEY` |
| No expiry tracking | None | `expires_at`, `last_refreshed_at` on tokens |
| Long-lived Meta token refresh | None | Re-exchange before expiry; webhook on deauth |
| Google refresh missing | None | Force `prompt=consent` when no refresh token |
| Service role overuse | None | RLS on metadata; service role only in API routes for tokens |

---

## 6. Webhook problems

| Issue | Baseline | Target |
|-------|----------|--------|
| Meta signature verification | None | HMAC SHA-256 `X-Hub-Signature-256` |
| Google channel verification | None | Validate channel token + resource headers |
| Duplicate events | None | Unique idempotency key per event |
| No audit trail | None | `integration_webhook_events` + `integration_sync_logs` |
| Synchronous heavy work | None | Persist first, process with retry-safe handler |

---

## 7. Multi-tenant data isolation risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cross-tenant token read | Critical | RLS: `workspace_id = auth.jwt() -> workspace_id` on all integration tables |
| Token columns in client queries | Critical | RLS policies exclude token table from authenticated role; server uses service role |
| Webhook routing wrong tenant | High | Map `provider_account_id` → connection via DB; reject unknown |
| OAuth state workspace spoofing | High | Signed state bound to session user + workspace membership check |
| Leak in error messages | Medium | Customer-safe errors; Sentry gets full detail server-side |

---

## 8. App review / Google verification risks

### Meta

- App must document each permission with screencast and use case.
- Webhooks require public HTTPS endpoint and subscribed fields documented.
- Development mode limits users; production requires Business Verification for some products.

### Google

- Sensitive scopes (Calendar): OAuth consent screen + verification.
- Restricted scopes (Gmail): security assessment; default **disabled** via `FEATURE_GOOGLE_GMAIL`.
- Publish consent screen only after domain verification.
- Use test users during development; incremental scope adds reduce re-review surface.

---

## 9. Sentry / logging gaps

| Gap | Baseline | Target |
|-----|----------|--------|
| Sentry SDK | None | `@sentry/nextjs` with PII scrubbing |
| OAuth breadcrumbs | None | `provider`, `workspace_id`, `step` (no tokens) |
| Webhook failures | None | Capture with `event_id`, `provider` |
| Structured logs | None | JSON logs via shared logger |
| Audit trail | None | `integration_sync_logs` for connect/disconnect/refresh |

---

## 10. Recommended fixes (priority order)

1. **P0** — Supabase schema + RLS; encrypted token storage; server-only token service.
2. **P0** — OAuth state helper with signing + PKCE (Meta).
3. **P0** — Meta connect/callback/status/disconnect/webhook routes.
4. **P0** — Google connect/callback/status/disconnect/watch/webhook routes.
5. **P1** — Integration settings UI (Meta + Google).
6. **P1** — Provider error normalization + customer messages.
7. **P1** — Webhook idempotency + sync logs.
8. **P2** — Feature flags: `FEATURE_META_INTEGRATION`, `FEATURE_GOOGLE_INTEGRATION`, `FEATURE_GOOGLE_GMAIL`.
9. **P2** — Token refresh cron / edge function (documented; hook points in API).
10. **P3** — E2E tests with provider sandboxes.

---

## 11. Implementation plan

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | This audit document | Complete |
| 2 | `supabase/migrations/*_integration_tables.sql` | In PR |
| 3 | Meta API routes + `MetaIntegrationService` + UI | In PR |
| 4 | Google API routes + `GoogleIntegrationService` + UI | In PR |
| 5 | Crypto, OAuth state, logging, Sentry, audit logs | In PR |
| 6 | Vitest unit/integration tests | In PR |
| 7 | Setup guides + customer guide + app-review doc | In PR |

---

## 12. Testing checklist

### Meta

- [ ] OAuth success with valid state
- [ ] Callback rejected on invalid/tampered state
- [ ] Callback rejected on expired state
- [ ] Missing scopes surfaced in status API
- [ ] Long-lived token exchange mocked
- [ ] Page tokens stored encrypted
- [ ] Instagram Business account detection (mock Graph)
- [ ] Webhook verification rejects bad signature
- [ ] Webhook persists event with idempotency
- [ ] Expired token → `needs_reconnect`
- [ ] Disconnect revokes local rows + audit log

### Google

- [ ] OAuth success; refresh token stored
- [ ] First connect without refresh → `prompt=consent`
- [ ] Token refresh updates `expires_at`
- [ ] `invalid_grant` → `needs_reconnect`
- [ ] Calendar module scope gating
- [ ] Meet link via `conferenceData` (unit mock)
- [ ] Gmail module disabled by default
- [ ] Watch registration mocked
- [ ] Webhook push persisted
- [ ] Quota error mapped to customer message
- [ ] Disconnect clears tokens

---

## 13. Customer-facing setup notes

### Meta

1. User must be admin of Facebook Page(s).
2. Connect via **Settings → Integrations → Meta**.
3. Grant only requested permissions; if Page missing, check Page role in Meta Business Settings.
4. If **Needs reconnect** appears, disconnect and reconnect; ensure app not removed from Page.
5. Instagram Business: IG account must be linked to Page in Meta Business Suite.

### Google

1. Connect with workspace Google account used for Calendar.
2. Enable **Calendar** for scheduling; **Gmail** only if org approves restricted verification.
3. If reconnect required, use **Disconnect** then connect; approve offline access when prompted.
4. Workspace admin may need to allow app in Google Workspace admin console.

---

## Appendix: Environment variables required

See `docs/meta-integration-setup.md` and `docs/google-integration-setup.md` for full lists.

**Critical secrets (server-only):**

- `INTEGRATION_TOKEN_ENCRYPTION_KEY` (32-byte base64)
- `OAUTH_STATE_SECRET`
- `META_APP_SECRET`
- `GOOGLE_CLIENT_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY`

---

*Next revision: update this doc after first production deployment with real traffic metrics and App Review outcomes.*
