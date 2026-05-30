import { describe, it, expect, beforeAll } from "vitest";
import { encryptToken, decryptToken } from "./crypto";

describe("token encryption", () => {
  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
  });

  it("round-trips plaintext", () => {
    const plain = "ya29.test-access-token-value";
    const cipher = encryptToken(plain);
    expect(cipher).not.toContain(plain);
    expect(decryptToken(cipher)).toBe(plain);
  });
});
