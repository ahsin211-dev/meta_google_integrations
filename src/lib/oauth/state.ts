import { createHash, randomBytes } from "crypto";
import { SignJWT, jwtVerify } from "jose";

export interface OAuthStatePayload {
  workspaceId: string;
  userId: string;
  provider: "meta" | "google";
  nonce: string;
  redirectAfter?: string;
  modules?: string[];
}

function getStateSecret(): Uint8Array {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) throw new Error("OAUTH_STATE_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signOAuthState(payload: OAuthStatePayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(getStateSecret());
}

export async function verifyOAuthState(token: string): Promise<OAuthStatePayload> {
  const { payload } = await jwtVerify(token, getStateSecret());
  const workspaceId = payload.workspaceId as string;
  const userId = payload.userId as string;
  const provider = payload.provider as "meta" | "google";
  const nonce = payload.nonce as string;
  if (!workspaceId || !userId || !provider || !nonce) {
    throw new Error("Invalid OAuth state payload");
  }
  return {
    workspaceId,
    userId,
    provider,
    nonce,
    redirectAfter: payload.redirectAfter as string | undefined,
    modules: payload.modules as string[] | undefined,
  };
}

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function hashStateForStorage(state: string): string {
  return createHash("sha256").update(state).digest("hex");
}
