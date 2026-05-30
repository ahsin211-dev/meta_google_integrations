import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyMetaWebhookSignature } from "@/lib/integrations/meta-webhook-signature";

describe("Meta webhook signature", () => {
  it("accepts valid signature", () => {
    const body = '{"entry":[]}';
    const secret = "test-secret";
    const sig =
      "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
    expect(() => verifyMetaWebhookSignature(sig, body, secret)).not.toThrow();
  });

  it("rejects invalid signature", () => {
    expect(() =>
      verifyMetaWebhookSignature("sha256=deadbeef", "{}", "secret")
    ).toThrow();
  });
});
