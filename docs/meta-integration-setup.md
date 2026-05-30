# Meta Integration Setup

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `META_APP_ID` | Yes | Facebook App ID |
| `META_APP_SECRET` | Yes | App secret (server only) |
| `META_OAUTH_REDIRECT_URI` | Yes | e.g. `https://app.example.com/api/integrations/meta/callback` |
| `META_GRAPH_API_VERSION` | Yes | e.g. `v21.0` (no hardcoding in code) |
| `META_WEBHOOK_VERIFY_TOKEN` | Yes | Random string for webhook verification |
| `INTEGRATION_TOKEN_ENCRYPTION_KEY` | Yes | 32-byte key, base64-encoded |
| `OAUTH_STATE_SECRET` | Yes | JWT signing secret for OAuth state |
| `FEATURE_META_INTEGRATION` | No | Default `true`; set `false` to disable |

## Required scopes

| Scope | Why |
|-------|-----|
| `pages_show_list` | List Pages the user manages for selection |
| `pages_read_engagement` | Read engagement metrics on connected Pages |
| `pages_manage_metadata` | Subscribe to webhooks / manage Page metadata |
| `instagram_basic` | IG Business profile (optional module) |
| `instagram_manage_insights` | IG insights (only if product needs analytics) |

Request **only** scopes your CRM uses. Extra scopes delay App Review.

## OAuth flow

1. `GET /api/integrations/meta/connect` — returns `{ authorizationUrl }`
2. User approves on Facebook
3. `GET /api/integrations/meta/callback` — exchanges code, long-lived token, page tokens
4. `GET /api/integrations/meta/status` — metadata only (no tokens)

PKCE is used (`code_challenge` S256). State is a signed JWT plus server session row.

## Webhooks

- URL: `https://<app>/api/integrations/meta/webhook`
- Verify token: `META_WEBHOOK_VERIFY_TOKEN`
- Subscribe to Page fields your product needs in Meta App Dashboard
- Signature: `X-Hub-Signature-256` validated with app secret

## App Review notes

- Provide screencast showing login → Page selection → feature use per permission
- Document data retention and deletion
- Use a production HTTPS callback URL
- Business Verification may be required for advanced access

## Testing steps

1. Add app as Facebook developer test user
2. Connect from `/settings/integrations`
3. Confirm Pages and IG accounts in status API
4. Send test webhook from Meta dashboard
5. Simulate expired token (Graph API error 190) → status shows `needs_reconnect`

## Common errors

| Symptom | Fix |
|---------|-----|
| Redirect URI mismatch | Add exact URI in Meta app settings |
| No Pages returned | User must be Page admin |
| Invalid signature on webhook | Check `META_APP_SECRET` and raw body parsing |
| Error 200 / permission error | Submit App Review for scope |
