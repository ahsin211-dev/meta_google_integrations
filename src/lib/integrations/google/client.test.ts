import { describe, it, expect } from "vitest";
import { buildGoogleAuthorizeUrl } from "./client";

describe("buildGoogleAuthorizeUrl", () => {
  it("requests offline access", () => {
    process.env.GOOGLE_SCOPES = "openid,email";
    process.env.GOOGLE_ENABLE_GMAIL = "false";

    const url = buildGoogleAuthorizeUrl({
      clientId: "cid",
      redirectUri: "http://localhost/cb",
      state: "abc",
    });

    expect(url).toContain("access_type=offline");
    expect(url).toContain("include_granted_scopes=true");
    expect(url).not.toContain("gmail");
  });
});
