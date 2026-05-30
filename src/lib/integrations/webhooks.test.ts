import { describe, it, expect } from "vitest";
import { verifyMetaWebhookSignature } from "./webhooks";
import { createHmac } from "crypto";

describe("verifyMetaWebhookSignature", () => {
  it("accepts valid signature", () => {
    const secret = "test-secret";
    const body = '{"entry":[]}';
    const sig = createHmac("sha256", secret).update(body).digest("hex");

    expect(
      verifyMetaWebhookSignature(body, `sha256=${sig}`, secret)
    ).toBe(true);
  });

  it("rejects invalid signature", () => {
    expect(
      verifyMetaWebhookSignature("{}", "sha256=deadbeef", "secret")
    ).toBe(false);
  });
});
