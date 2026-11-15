/**
 * Builds the browser redirect for Meta's Instagram Unified Login configuration.
 *
 * New Instagram messaging apps use Facebook Login for Business with a config_id.
 * Meta hosts this dialog on facebook.com; the user can choose "Continue with Instagram"
 * and authenticate with Instagram credentials. Do not add a legacy scope list or
 * generic OAuth prompt parameter: permissions and the login experience are defined
 * by the saved Business Login configuration.
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
  url.searchParams.set("state", input.state);
  return url.toString();
}
