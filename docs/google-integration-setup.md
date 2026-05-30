# Google Integration Setup (Operators)

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Server only |
| `GOOGLE_REDIRECT_URI` | Yes | Authorized redirect URI |
| `GOOGLE_SCOPES` | Yes | Space or comma-separated scopes |
| `GOOGLE_ENABLE_GMAIL` | No | `true` adds Gmail readonly (verification required) |
| `GOOGLE_WEBHOOK_CHANNEL_TOKEN` | Yes | Secret sent on Calendar push notifications |
| `INTEGRATIONS_GOOGLE_ENABLED` | No | Feature flag |
| `TOKEN_ENCRYPTION_KEY` | Yes | AES-256-GCM key (base64, 32 bytes) |
| `APP_URL` | Yes | Used for webhook callback URL |

## Default scopes

| Scope | Why |
|-------|-----|
| `openid`, `email`, `profile` | Identify connected Google account |
| `https://www.googleapis.com/auth/calendar` | Calendar read/write; Meet via `conferenceData` |

Gmail (`gmail.readonly`) is **off by default**. Enable only after Google verification.

## Google Cloud Console

1. Create project → **APIs & Services** → **OAuth consent screen** (External).
2. Create **OAuth 2.0 Client** (Web application).
3. Authorized redirect URI: `{APP_URL}/api/integrations/google/callback`
4. Enable **Google Calendar API** (and Gmail API only if needed).
5. Publish consent screen when ready for production users.

## API routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/integrations/google/connect` | Returns `{ authorizeUrl }` |
| GET | `/api/integrations/google/callback` | OAuth callback |
| GET | `/api/integrations/google/status` | Metadata only |
| POST | `/api/integrations/google/disconnect` | Revoke locally |
| POST | `/api/integrations/google/watch` | Register Calendar push channel |
| POST | `/api/integrations/google/webhook` | Receive push notifications |

## Refresh tokens

- First connect uses `prompt=consent` and `access_type=offline`.
- If Google does not return `refresh_token`, connection is `needs_reconnect`.
- Access tokens refresh automatically when within 5 minutes of expiry.

## Google Meet

Meet links are created server-side via Calendar `events.insert` with:

```json
"conferenceData": {
  "createRequest": {
    "requestId": "<unique>",
    "conferenceSolutionKey": { "type": "hangoutsMeet" }
  }
}
```

Use `conferenceDataVersion=1` on the API request.

## Testing

```bash
curl -H "x-workspace-id: <uuid>" -H "x-user-id: <uuid>" \
  http://localhost:3000/api/integrations/google/connect
```

After connect:

```bash
curl -X POST -H "x-workspace-id: <uuid>" -H "x-user-id: <uuid>" \
  http://localhost:3000/api/integrations/google/watch
```

## Common errors

| Error | Fix |
|-------|-----|
| `invalid_grant` | User revoked access — reconnect |
| `access_denied` | User declined scope or app in Testing without test user |
| Missing refresh token | Reconnect with `reconnect=true` |
| Quota exceeded | Back off; request quota increase in Cloud Console |
