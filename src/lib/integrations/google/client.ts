import {
  getGoogleApiBaseUrl,
  getGoogleOAuthBaseUrl,
  getGoogleScopes,
} from "../config";
import { normalizeGoogleError } from "../errors";

export function buildGoogleAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  prompt?: string;
}): string {
  const url = new URL(`${getGoogleOAuthBaseUrl()}/o/oauth2/v2/auth`);
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", getGoogleScopes().join(" "));
  url.searchParams.set("state", params.state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", params.prompt ?? "consent");
  return url.toString();
}

export async function exchangeGoogleCode(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number;
  scope: string;
}> {
  const res = await fetch(`${getGoogleOAuthBaseUrl()}/o/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw normalizeGoogleError(res.status, body);
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresIn: body.expires_in ?? 3600,
    scope: body.scope ?? "",
  };
}

export async function refreshGoogleAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const res = await fetch(`${getGoogleOAuthBaseUrl()}/o/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw normalizeGoogleError(res.status, body);
  }

  return {
    accessToken: body.access_token,
    expiresIn: body.expires_in ?? 3600,
  };
}

export async function fetchGoogleUserInfo(
  accessToken: string
): Promise<{ id: string; email: string; name: string }> {
  const res = await fetch(
    `${getGoogleApiBaseUrl()}/oauth2/v2/userinfo`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const body = await res.json();
  if (!res.ok) {
    throw normalizeGoogleError(res.status, body);
  }
  return {
    id: body.id ?? body.sub,
    email: body.email,
    name: body.name,
  };
}

export async function createCalendarEventWithMeet(params: {
  accessToken: string;
  calendarId?: string;
  summary: string;
  startIso: string;
  endIso: string;
}): Promise<{ eventId: string; meetLink: string | null }> {
  const calendarId = params.calendarId ?? "primary";
  const res = await fetch(
    `${getGoogleApiBaseUrl()}/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: params.summary,
        start: { dateTime: params.startIso },
        end: { dateTime: params.endIso },
        conferenceData: {
          createRequest: {
            requestId: `meet-${Date.now()}`,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      }),
    }
  );

  const body = await res.json();
  if (!res.ok) {
    throw normalizeGoogleError(res.status, body);
  }

  const meetLink =
    body.hangoutLink ??
    body.conferenceData?.entryPoints?.find(
      (e: { entryPointType?: string }) => e.entryPointType === "video"
    )?.uri ??
    null;

  return { eventId: body.id, meetLink };
}

export async function registerCalendarWatch(params: {
  accessToken: string;
  calendarId?: string;
  webhookUrl: string;
  channelId: string;
  channelToken: string;
}): Promise<{ resourceId: string; expiration: string }> {
  const calendarId = params.calendarId ?? "primary";
  const res = await fetch(
    `${getGoogleApiBaseUrl()}/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/watch`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: params.channelId,
        type: "web_hook",
        address: params.webhookUrl,
        token: params.channelToken,
      }),
    }
  );

  const body = await res.json();
  if (!res.ok) {
    throw normalizeGoogleError(res.status, body);
  }

  return {
    resourceId: body.resourceId,
    expiration: body.expiration,
  };
}
