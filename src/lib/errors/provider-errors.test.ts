import { describe, expect, it } from "vitest";
import {
  customerMessageForCode,
  normalizeGoogleError,
  normalizeMetaGraphError,
} from "./provider-errors";

describe("provider errors", () => {
  it("maps Meta token expiry", () => {
    const err = normalizeMetaGraphError({ error: { message: "expired", code: 190 } });
    expect(err.code).toBe("token_expired");
  });

  it("maps Google invalid_grant", () => {
    const err = normalizeGoogleError(400, { error: "invalid_grant" });
    expect(err.code).toBe("token_revoked");
  });

  it("returns customer-safe messages", () => {
    expect(customerMessageForCode("oauth_invalid_state")).toContain("expired");
  });
});
