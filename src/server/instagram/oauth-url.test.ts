import { describe, expect, it } from "vitest";
import { buildUnifiedLoginAuthorizeUrl } from "./oauth-url";

describe("buildUnifiedLoginAuthorizeUrl", () => {
  it("uses the Meta OAuth dialog and the Facebook Login for Business configuration", () => {
    const result = new URL(
      buildUnifiedLoginAuthorizeUrl({
        appId: "123456789012345",
        configId: "987654321098765",
        redirectUri: "https://autodm.example.com/api/instagram/oauth/callback",
        state: "csrf-state",
      }),
    );

    expect(result.origin).toBe("https://www.facebook.com");
    expect(result.pathname).toBe("/dialog/oauth");
    expect(result.searchParams.get("client_id")).toBe("123456789012345");
    expect(result.searchParams.get("config_id")).toBe("987654321098765");
    expect(result.searchParams.get("redirect_uri")).toBe(
      "https://autodm.example.com/api/instagram/oauth/callback",
    );
    expect(result.searchParams.get("response_type")).toBe("code");
    expect(result.searchParams.get("override_default_response_type")).toBe("true");
    expect(result.searchParams.get("state")).toBe("csrf-state");
    expect(result.searchParams.has("scope")).toBe(false);
  });
});
