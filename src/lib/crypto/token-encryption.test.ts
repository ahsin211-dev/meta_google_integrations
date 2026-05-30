import { randomBytes } from "crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "./token-encryption";

beforeAll(() => {
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("token encryption", () => {
  it("round-trips tokens", () => {
    const plain = "ya29.test-access-token";
    const enc = encryptToken(plain);
    expect(enc).not.toContain(plain);
    expect(decryptToken(enc)).toBe(plain);
  });

  it("rejects tampered ciphertext", () => {
    const enc = encryptToken("token");
    const buf = Buffer.from(enc, "base64");
    buf[buf.length - 1] ^= 0xff;
    expect(() => decryptToken(buf.toString("base64"))).toThrow();
  });
});
