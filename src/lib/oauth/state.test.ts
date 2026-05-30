import { beforeAll, describe, expect, it } from "vitest";
import {
  generatePkcePair,
  hashStateForStorage,
  signOAuthState,
  verifyOAuthState,
} from "./state";

beforeAll(() => {
  process.env.OAUTH_STATE_SECRET = "test-secret-at-least-16-chars";
});

describe("OAuth state", () => {
  it("signs and verifies state", async () => {
    const token = await signOAuthState({
      workspaceId: "ws-1",
      userId: "user-1",
      provider: "meta",
      nonce: "n1",
    });
    const payload = await verifyOAuthState(token);
    expect(payload.workspaceId).toBe("ws-1");
    expect(payload.provider).toBe("meta");
  });

  it("generates valid PKCE pair", () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    expect(codeVerifier.length).toBeGreaterThan(20);
    expect(codeChallenge.length).toBeGreaterThan(20);
  });

  it("hashes state deterministically", () => {
    expect(hashStateForStorage("abc")).toBe(hashStateForStorage("abc"));
    expect(hashStateForStorage("abc")).not.toBe(hashStateForStorage("def"));
  });
});
