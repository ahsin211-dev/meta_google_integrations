import { beforeAll, describe, expect, it } from "vitest";
import { getGoogleScopesForModules } from "./google-scopes";

beforeAll(() => {
  process.env.FEATURE_GOOGLE_GMAIL = "false";
});

describe("Google scopes", () => {
  it("includes calendar for calendar module", () => {
    const scopes = getGoogleScopesForModules(["calendar", "meet"]);
    expect(scopes.some((s) => s.includes("calendar"))).toBe(true);
  });

  it("excludes gmail when feature disabled", () => {
    const scopes = getGoogleScopesForModules(["gmail"]);
    expect(scopes.some((s) => s.includes("gmail"))).toBe(false);
  });
});
