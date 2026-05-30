import { describe, it, expect } from "vitest";
import { buildMetaAuthorizeUrl } from "./client";

describe("buildMetaAuthorizeUrl", () => {
  it("uses env graph version in path", () => {
    process.env.META_GRAPH_API_VERSION = "v21.0";
    process.env.META_SCOPES = "pages_show_list";

    const url = buildMetaAuthorizeUrl({
      appId: "123",
      redirectUri: "http://localhost/cb",
      state: "state123",
    });

    expect(url).toContain("facebook.com/v21.0/dialog/oauth");
    expect(url).toContain("client_id=123");
    expect(url).toContain("state=state123");
    expect(url).toContain("pages_show_list");
  });
});
