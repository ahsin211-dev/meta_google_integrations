import { normalizeGoogleError } from "@/lib/errors/provider-errors";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export function buildGoogleOAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
  prompt?: "consent" | "select_account";
  includeGrantedScopes?: boolean;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", input.scopes.join(" "));
  url.searchParams.set("state", input.state);
  url.searchParams.set("access_type", "offline");
  if (input.prompt) url.searchParams.set("prompt", input.prompt);
  if (input.includeGrantedScopes) {
    url.searchParams.set("include_granted_scopes", "true");
  }
  return url.toString();
}

export async function exchangeGoogleCode(input: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const body = await res.json();
  if (!res.ok) throw normalizeGoogleError(res.status, body);
  return body;
}

export async function refreshGoogleToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<{
  access_token: string;
  expires_in: number;
  scope?: string;
}> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: input.refreshToken,
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  const body = await res.json();
  if (!res.ok) throw normalizeGoogleError(res.status, body);
  return body;
}

export async function revokeGoogleToken(token: string): Promise<void> {
  await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" });
}

export class GoogleCalendarClient {
  constructor(private accessToken: string) {}

  async createEventWithMeet(input: {
    calendarId?: string;
    summary: string;
    start: string;
    end: string;
  }): Promise<unknown> {
    const calendarId = input.calendarId ?? "primary";
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: input.summary,
          start: { dateTime: input.start },
          end: { dateTime: input.end },
          conferenceData: {
            createRequest: {
              requestId: crypto.randomUUID(),
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }),
      }
    );
    const body = await res.json();
    if (!res.ok) throw normalizeGoogleError(res.status, body);
    return body;
  }

  async registerWatch(input: {
    calendarId?: string;
    webhookUrl: string;
    channelId: string;
    channelToken: string;
  }): Promise<unknown> {
    const calendarId = input.calendarId ?? "primary";
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: input.channelId,
          type: "web_hook",
          address: input.webhookUrl,
          token: input.channelToken,
        }),
      }
    );
    const body = await res.json();
    if (!res.ok) throw normalizeGoogleError(res.status, body);
    return body;
  }
}

export async function getGoogleUserInfo(accessToken: string): Promise<{
  sub: string;
  email: string;
  name?: string;
}> {
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await res.json();
  if (!res.ok) throw normalizeGoogleError(res.status, body);
  return body;
}
