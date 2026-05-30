export function getAppUrl(): string {
  const url = process.env.APP_URL ?? "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export function isMetaEnabled(): boolean {
  return process.env.INTEGRATIONS_META_ENABLED !== "false";
}

export function isGoogleEnabled(): boolean {
  return process.env.INTEGRATIONS_GOOGLE_ENABLED !== "false";
}

export function isGoogleGmailEnabled(): boolean {
  return process.env.GOOGLE_ENABLE_GMAIL === "true";
}

export function getMetaGraphVersion(): string {
  return process.env.META_GRAPH_API_VERSION ?? "v21.0";
}

export function getMetaGraphBaseUrl(): string {
  return `https://graph.facebook.com/${getMetaGraphVersion()}`;
}

export function getMetaOAuthBaseUrl(): string {
  return "https://www.facebook.com";
}

export function getMetaScopes(): string[] {
  return (process.env.META_SCOPES ?? "pages_show_list,pages_read_engagement")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function getGoogleScopes(): string[] {
  const base = (process.env.GOOGLE_SCOPES ??
    "openid,email,profile,https://www.googleapis.com/auth/calendar")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (isGoogleGmailEnabled()) {
    const gmailScope = "https://www.googleapis.com/auth/gmail.readonly";
    if (!base.includes(gmailScope)) {
      base.push(gmailScope);
    }
  }

  return base;
}

export function getGoogleOAuthBaseUrl(): string {
  return "https://accounts.google.com";
}

export function getGoogleApiBaseUrl(): string {
  return "https://www.googleapis.com";
}
