# Meta Integration Setup (Operators)

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `META_APP_ID` | Yes | Facebook App ID |
| `META_APP_SECRET` | Yes | App secret (server only) |
| `META_REDIRECT_URI` | Yes | Must match Facebook Login redirect URI exactly |
| `META_WEBHOOK_VERIFY_TOKEN` | Yes | Random string for webhook verification |
| `META_GRAPH_API_VERSION` | Yes | e.g. `v21.0` — never hardcode in application code |
| `META_SCOPES` | Yes | Comma-separated minimal scopes |
| `META_OAUTH_USE_PKCE` | No | `true` to enable PKCE |
| `INTEGRATIONS_META_ENABLED` | No | Feature flag (`false` disables connect) |
| `TOKEN_ENCRYPTION_KEY` | Yes | 32-byte base64 key for token ciphertext |
| `APP_URL` | Yes | Public app URL for redirects |

## Default scopes and rationale

| Scope | Why |
|-------|-----|
| `pages_show_list` | List Pages the user manages for page selection |
| `pages_read_engagement` | Read basic engagement metrics on connected Pages |
| `instagram_basic` | Detect Instagram Business accounts linked to Pages |

Add `pages_manage_metadata` only if you subscribe to webhooks programmatically.

## Facebook Developer Console

1. Create a **Business** app with **Facebook Login** and **Webhooks** products.
2. Add **Valid OAuth Redirect URIs**: `{APP_URL}/api/integrations/meta/callback`
3. Configure **Webhooks** callback URL: `{APP_URL}/api/integrations/meta/webhook`
4. Set **Verify Token** to `META_WEBHOOK_VERIFY_TOKEN`.
5. Subscribe to `feed`, `messages`, or other fields as product requires.
6. Add Privacy Policy and Data Deletion callback URLs for App Review.

## API routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/integrations/meta/connect` | Returns `{ authorizeUrl }` |
| GET | `/api/integrations/meta/callback` | OAuth callback (browser redirect) |
| GET | `/api/integrations/meta/status` | Connection metadata (no tokens) |
| POST | `/api/integrations/meta/disconnect` | Revoke local connection |
| GET/POST | `/api/integrations/meta/webhook` | Verification + events |

## Token lifecycle

1. Short-lived user token from code exchange
2. Long-lived user token (~60 days) stored encrypted on `integration_connections`
3. Page access tokens stored per `integration_accounts` row
4. On Graph API `190` errors → mark `needs_reconnect`

## Testing

```bash
# Local dev auth (enable INTEGRATION_DEV_AUTH=true)
export INTEGRATION_DEV_AUTH=true
curl -H "x-workspace-id: <uuid>" -H "x-user-id: <uuid>" \
  http://localhost:3000/api/integrations/meta/connect
```

See `docs/integrations-audit.md` §12 for the full Meta test checklist.

## Common errors

| Error | Fix |
|-------|-----|
| Redirect URI mismatch | Align `META_REDIRECT_URI` with Facebook console |
| `(#200) Permissions error` | Reconnect; grant all scopes; submit App Review |
| Invalid OAuth state | User took >15 min or double-submitted callback |
| Webhook verification failed | Check `META_WEBHOOK_VERIFY_TOKEN` |
