import {
  getMetaGraphBaseUrl,
  getMetaOAuthBaseUrl,
  getMetaScopes,
  getMetaGraphVersion,
} from "../config";
import { normalizeMetaGraphError } from "../errors";

export function buildMetaAuthorizeUrl(params: {
  appId: string;
  redirectUri: string;
  state: string;
  codeChallenge?: string;
}): string {
  const base = getMetaOAuthBaseUrl();
  const version = getMetaGraphVersion();
  const url = new URL(`${base}/${version}/dialog/oauth`);
  url.searchParams.set("client_id", params.appId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("scope", getMetaScopes().join(","));
  url.searchParams.set("response_type", "code");
  if (params.codeChallenge) {
    url.searchParams.set("code_challenge", params.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}

export async function exchangeMetaCode(params: {
  appId: string;
  appSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier?: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(`${getMetaGraphBaseUrl()}/oauth/access_token`);
  url.searchParams.set("client_id", params.appId);
  url.searchParams.set("client_secret", params.appSecret);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("code", params.code);
  if (params.codeVerifier) {
    url.searchParams.set("code_verifier", params.codeVerifier);
  }

  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) {
    throw normalizeMetaGraphError(body);
  }

  return {
    accessToken: body.access_token as string,
    expiresIn: (body.expires_in as number) ?? 0,
  };
}

export async function exchangeMetaLongLivedToken(params: {
  appId: string;
  appSecret: string;
  shortLivedToken: string;
}): Promise<{ accessToken: string; expiresIn: number }> {
  const url = new URL(`${getMetaGraphBaseUrl()}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", params.appId);
  url.searchParams.set("client_secret", params.appSecret);
  url.searchParams.set("fb_exchange_token", params.shortLivedToken);

  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) {
    throw normalizeMetaGraphError(body);
  }

  return {
    accessToken: body.access_token as string,
    expiresIn: (body.expires_in as number) ?? 5184000,
  };
}

export async function fetchMetaMe(accessToken: string): Promise<{
  id: string;
  name: string;
}> {
  const url = new URL(`${getMetaGraphBaseUrl()}/me`);
  url.searchParams.set("fields", "id,name");
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) {
    throw normalizeMetaGraphError(body);
  }
  return { id: body.id, name: body.name };
}

export interface MetaPageAccount {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id: string };
}

export async function fetchMetaPages(
  accessToken: string
): Promise<MetaPageAccount[]> {
  const url = new URL(`${getMetaGraphBaseUrl()}/me/accounts`);
  url.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account{id}"
  );
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) {
    throw normalizeMetaGraphError(body);
  }

  return (body.data as MetaPageAccount[]) ?? [];
}

export async function fetchInstagramBusinessAccount(
  pageId: string,
  pageAccessToken: string
): Promise<{ id: string; username?: string } | null> {
  const url = new URL(`${getMetaGraphBaseUrl()}/${pageId}`);
  url.searchParams.set(
    "fields",
    "instagram_business_account{id,username}"
  );
  url.searchParams.set("access_token", pageAccessToken);

  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) {
    return null;
  }

  const ig = body.instagram_business_account;
  if (!ig?.id) return null;
  return { id: ig.id, username: ig.username };
}
