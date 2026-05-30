# Google Integration Setup

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Server only |
| `GOOGLE_OAUTH_REDIRECT_URI` | Yes | e.g. `https://app.example.com/api/integrations/google/callback` |
| `GOOGLE_WEBHOOK_CHANNEL_TOKEN` | Recommended | Validated on Calendar push notifications |
| `FEATURE_GOOGLE_INTEGRATION` | No | Default `true` |
| `FEATURE_GOOGLE_GMAIL` | No | Default `false` — enable only if Gmail is required |
| `INTEGRATION_TOKEN_ENCRYPTION_KEY` | Yes | 32-byte base64 key |
| `OAUTH_STATE_SECRET` | Yes | OAuth state JWT secret |

## Required scopes (by module)

### Calendar + Meet (default)

| Scope | Why |
|-------|-----|
| `openid`, `email`, `profile` | Identify connected account |
| `https://www.googleapis.com/auth/calendar` | Read/write calendars |
| `https://www.googleapis.com/auth/calendar.events` | Manage events |

Meet links are created via Calendar `conferenceData` with `hangoutsMeet` — no separate Meet scope.

### Gmail (optional, restricted)

| Scope | Why |
|-------|-----|
| `https://www.googleapis.com/auth/gmail.readonly` | Read mail — **restricted**; triggers security assessment |

Keep `FEATURE_GOOGLE_GMAIL=false` until verification is complete.

## OAuth flow

1. `GET /api/integrations/google/connect?modules=calendar,meet`
2. Uses `access_type=offline` for refresh tokens
3. `prompt=consent` when refresh token missing
4. `include_granted_scopes=true` for incremental auth
5. Callback stores encrypted access + refresh tokens server-side

## Calendar watch / webhook

- `POST /api/integrations/google/watch` — registers push channel
- `POST /api/integrations/google/webhook` — receives notifications
- Validate `X-Goog-Channel-Token` matches `GOOGLE_WEBHOOK_CHANNEL_TOKEN`

## Verification readiness

- **Sensitive** scopes (Calendar): complete OAuth consent screen + Google verification
- **Restricted** scopes (Gmail): security assessment; keep disabled by default
- Publish app only after domain verification
- Add privacy policy and scope justification URLs

## Testing steps

1. Add test users on OAuth consent screen (Testing mode)
2. Connect and confirm refresh token in DB (encrypted)
3. Call status — verify scopes listed
4. Register watch; trigger calendar change
5. Revoke app in Google Account → reconnect flow

## Common errors

| Symptom | Fix |
|---------|-----|
| `invalid_grant` on refresh | User revoked access — reconnect with consent |
| No refresh token | Disconnect, reconnect with `force_consent=true` |
| 403 / accessNotConfigured | Enable Calendar API in GCP project |
| 429 quota | Back off; show customer quota message |
