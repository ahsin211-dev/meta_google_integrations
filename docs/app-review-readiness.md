# App Review & Verification Readiness

Checklist for shipping Meta and Google integrations to production tenants.

## Security baseline (both providers)

- [ ] Access tokens stored **encrypted** (`INTEGRATION_TOKEN_ENCRYPTION_KEY`)
- [ ] Tokens never returned from status APIs or UI
- [ ] OAuth `state` signed + server session validated
- [ ] RLS on all integration tables by `workspace_id`
- [ ] `integration_tokens` denied to `authenticated` role
- [ ] Service role used only in API routes / workers
- [ ] Feature flags for phased rollout
- [ ] Sentry configured without token/PII in breadcrumbs
- [ ] Customer-safe error messages (no raw provider payloads)

## Meta App Review

### Prerequisites

- [ ] Production HTTPS URLs for OAuth redirect and webhooks
- [ ] Privacy Policy URL and Terms URL on app settings
- [ ] Data deletion instructions / callback if storing user data
- [ ] App icon and clear app display name

### Per-permission documentation

For each scope in `META_REQUIRED_SCOPES` (+ IG if used):

- [ ] Written use case (1–2 sentences)
- [ ] Screencast: login → grant → feature using that data
- [ ] Test user credentials for reviewer (or clear test steps)

### Webhooks

- [ ] `META_WEBHOOK_VERIFY_TOKEN` configured
- [ ] Subscribed fields match actual product usage
- [ ] Idempotent webhook processing (`integration_webhook_events`)

### Common rejection reasons

- Requesting unused permissions
- Screencast does not show permission in use
- Webhook endpoint not reachable or invalid SSL

## Google OAuth verification

### Consent screen

- [ ] App name, support email, logo
- [ ] Authorized domains include production domain
- [ ] Privacy policy + homepage URLs
- [ ] Scope justifications filled for each sensitive scope

### Sensitive scopes (Calendar)

- [ ] Demo video showing Calendar data usage
- [ ] Limited test users during development
- [ ] Incremental scope adds (`include_granted_scopes`) documented

### Restricted scopes (Gmail)

- [ ] **Disabled** via `FEATURE_GOOGLE_GMAIL=false` until approved
- [ ] Security assessment scheduled before enabling
- [ ] Separate justification for mail data handling

### Production launch

- [ ] Move consent screen to **Production** after verification
- [ ] Monitor `invalid_grant` and quota errors in Sentry
- [ ] Document Workspace admin allowlist steps for enterprise customers

## Operational readiness

- [ ] Runbooks for token refresh failures
- [ ] Cron/job to refresh Google tokens before expiry
- [ ] Alert on webhook processing failures
- [ ] `integration_sync_logs` retained per compliance policy
- [ ] Disconnect flow tested (tokens deleted, provider revoke attempted)

## Testing evidence for reviewers

Store in your compliance folder:

- OAuth success logs (redacted)
- Webhook verification test output
- Screenshots of integration settings UI
- List of exact scopes in production vs staging

## References

- [Meta Access Tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens)
- [Google Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
- [Google Restricted scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification)
