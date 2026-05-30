import { describe, it, expect } from "vitest";
import {
  generateOAuthState,
  generatePkceVerifier,
  pkceChallengeFromVerifier,
} from "./oauth-state";

describe("oauth state helpers", () => {
  it("generates unique state values", () => {
    const a = generateOAuthState();
    const b = generateOAuthState();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(20);
  });

  it("produces valid PKCE challenge", () => {
    const verifier = generatePkceVerifier();
    const challenge = pkceChallengeFromVerifier(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(challenge).not.toBe(verifier);
  });
});
