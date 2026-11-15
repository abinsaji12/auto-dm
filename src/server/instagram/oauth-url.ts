/**
 * Builds the browser redirect for Meta Facebook Login for Business Unified Login.
 *
 * New Instagram messaging apps use this Meta-hosted dialog even when the person
 * authenticates with Instagram. The explicit prompt asks Meta to show the
 * Instagram/Facebook sign-in choices instead of silently reusing a Facebook session.
 *
 * For System-user access token configurations, Meta replaces the legacy `scope`
 * parameter with `config_id`. When requesting an authorization code, the
 * `override_default_response_type=true` flag is required so the configuration's
 * code response is honored.
 */
export interface UnifiedLoginAuthorizeInput {
  appId: string;
  configId: string;
  redirectUri: string;
  state: string;
}

export function buildUnifiedLoginAuthorizeUrl(input: UnifiedLoginAuthorizeInput): string {
  const url = new URL("https://www.facebook.com/dialog/oauth");
  url.searchParams.set("client_id", input.appId);
  url.searchParams.set("config_id", input.configId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("override_default_response_type", "true");
  url.searchParams.set("prompt", "login");
  url.searchParams.set("state", input.state);
  return url.toString();
}
