import { metaGraphBaseUrl } from "@/lib/env";
import { normalizeMetaGraphError } from "@/lib/errors/provider-errors";

export class MetaGraphClient {
  constructor(private accessToken: string) {}

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${metaGraphBaseUrl()}${path}`);
    url.searchParams.set("access_token", this.accessToken);
    if (params) {
      for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString());
    const body = await res.json();
    if (!res.ok) {
      throw normalizeMetaGraphError(body);
    }
    return body as T;
  }

  async exchangeShortLivedToken(appId: string, appSecret: string): Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }> {
    return this.request("/oauth/access_token", {
      grant_type: "fb_exchange_token",
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: this.accessToken,
    });
  }

  async getMeAccounts(): Promise<{
    data: Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string };
    }>;
  }> {
    return this.request("/me/accounts", {
      fields: "id,name,access_token,instagram_business_account",
    });
  }

  async getInstagramAccount(igUserId: string): Promise<{ id: string; username?: string }> {
    return this.request(`/${igUserId}`, { fields: "id,username" });
  }
}

export async function exchangeCodeForMetaToken(input: {
  code: string;
  redirectUri: string;
  appId: string;
  appSecret: string;
}): Promise<{ accessToken: string; expiresIn?: number }> {
  const url = new URL(`${metaGraphBaseUrl()}/oauth/access_token`);
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("client_secret", input.appSecret);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("code", input.code);

  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) throw normalizeMetaGraphError(body);

  const data = body as { access_token: string; expires_in?: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export function buildMetaOAuthUrl(input: {
  appId: string;
  redirectUri: string;
  state: string;
  scopes: string[];
  graphApiVersion: string;
  codeChallenge?: string;
}): string {
  const version = input.graphApiVersion.startsWith("v")
    ? input.graphApiVersion
    : `v${input.graphApiVersion}`;
  const url = new URL(`https://www.facebook.com/${version}/dialog/oauth`);
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("scope", input.scopes.join(","));
  url.searchParams.set("response_type", "code");
  if (input.codeChallenge) {
    url.searchParams.set("code_challenge", input.codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}
