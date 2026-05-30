import { describe, it, expect } from "vitest";
import { normalizeMetaGraphError, normalizeGoogleError } from "./errors";

describe("normalizeMetaGraphError", () => {
  it("maps expired token", () => {
    const err = normalizeMetaGraphError({ error: { code: 190, message: "expired" } });
    expect(err.code).toBe("token_expired");
    expect(err.customerMessage).toMatch(/reconnect/i);
  });

  it("maps permission errors", () => {
    const err = normalizeMetaGraphError({ error: { code: 200 } });
    expect(err.code).toBe("permission_denied");
  });
});

describe("normalizeGoogleError", () => {
  it("maps invalid_grant", () => {
    const err = normalizeGoogleError(401, { error: "invalid_grant" });
    expect(err.code).toBe("refresh_failed");
  });

  it("maps quota", () => {
    const err = normalizeGoogleError(429, { error: "rate_limit" });
    expect(err.code).toBe("quota_exceeded");
  });
});
