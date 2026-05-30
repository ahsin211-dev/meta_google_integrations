import { describe, expect, it } from "vitest";
import { getMetaOAuthScopes, getMissingScopes, META_REQUIRED_SCOPES } from "./meta-scopes";

describe("Meta scopes", () => {
  it("includes required page scopes", () => {
    const scopes = getMetaOAuthScopes(false);
    for (const s of META_REQUIRED_SCOPES) {
      expect(scopes).toContain(s);
    }
    expect(scopes.some((s) => s.startsWith("instagram_"))).toBe(false);
  });

  it("detects missing scopes", () => {
    expect(getMissingScopes(["pages_show_list"], [...META_REQUIRED_SCOPES]).length).toBe(2);
  });
});
