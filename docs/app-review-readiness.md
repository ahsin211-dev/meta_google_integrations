# App Review & Google Verification Readiness

## Meta (Facebook) App Review

### Pre-submission checklist

- [ ] App switched to **Live** mode only after review approval
- [ ] Privacy Policy URL publicly accessible
- [ ] Data deletion instructions URL configured
- [ ] App icon, category, and contact email complete
- [ ] Screencast demonstrating each requested permission on a test Page
- [ ] Test users added while in Development mode

### Scope justification template

| Permission | User-facing purpose | Data handling |
|------------|-------------------|---------------|
| `pages_show_list` | Let admins pick which Pages to connect | Page IDs/names stored per workspace |
| `pages_read_engagement` | Show engagement in CRM dashboards | Aggregated metrics only |
| `instagram_basic` | Show linked Instagram Business account | IG account ID/username |

### Review risks

| Risk | Mitigation |
|------|------------|
| Over-requested permissions | Request minimum scopes; add advanced scopes in phase 2 |
| Business verification | Complete Meta Business Verification early |
| Webhook fields without use | Only subscribe to fields you process |

### Error messages (customer-safe)

| Internal code | Customer message |
|---------------|------------------|
| `token_expired` | Reconnect Meta |
| `permission_denied` | Reconnect and grant all listed permissions |
| `app_review_required` | Integration pending approval—contact support |

---

## Google OAuth verification

### Sensitive / restricted scopes

| Scope | Classification | Action |
|-------|----------------|--------|
| Calendar | Sensitive | Complete OAuth verification for production |
| Gmail readonly | Restricted | Security assessment + limited use justification |

**Recommendation:** Ship Calendar + Meet first with Gmail disabled (`GOOGLE_ENABLE_GMAIL=false`).

### Consent screen

- [ ] Application home page
- [ ] Privacy policy
- [ ] Authorized domains include production domain
- [ ] Scopes match code (`GOOGLE_SCOPES`)
- [ ] Demo video for each sensitive scope

### Verification risks

| Risk | Mitigation |
|------|------------|
| Scope creep | Incremental authorization per module |
| Missing refresh tokens | Document reconnect UX; use `prompt=consent` on first connect |
| Unverified app user cap | Stay in Testing until verification completes |

---

## Security controls for reviewers

| Control | Implementation |
|---------|----------------|
| Tokens not in browser | API returns metadata only; tokens in `integration_tokens` with deny-all RLS |
| Encryption at rest | `TOKEN_ENCRYPTION_KEY` + AES-256-GCM |
| Tenant isolation | `workspace_id` on all rows + RLS |
| Webhook authenticity | Meta HMAC signature; Google channel token |
| Audit trail | `integration_sync_logs` for connect/disconnect/refresh |

---

## Evidence to attach in submissions

1. Architecture diagram (OAuth server-side only)
2. Link to `docs/integrations-audit.md`
3. Screenshots of integration settings UI
4. List of webhook fields and retention policy
5. Data retention / deletion runbook

---

## Testing evidence

Run checklists in `docs/integrations-audit.md` §12 and attach:

- OAuth success recording (both providers)
- Reconnect flow recording
- Webhook delivery log from `integration_webhook_events`
- Sentry issue sample with scrubbed tokens (verify no secrets in breadcrumbs)
