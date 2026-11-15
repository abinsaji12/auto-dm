import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { appUrl } from "@/env";
import { deriveKey, randomToken, safeEqual } from "@/server/crypto";
import type { InstagramAccount } from "@/server/db/schema";
import type { SubscriptionStatus } from "@/lib/webhook-diagnostics";
import { logger } from "@/server/log";
import { getMetaAppSecret, getMetaAppSettings, setSetting } from "@/server/settings";
import { tokenResponseSchema, upsertAccount } from "./account";
import { UNIFIED_LOGIN_TOKEN_URL } from "./constants";
import { buildUnifiedLoginAuthorizeUrl } from "./oauth-url";
import { GraphApiError, graphId, graphRequest, safeErrorMessage } from "./graph";

const log = logger("oauth");

export const OAUTH_STATE_COOKIE = "ig_oauth_state";
export const OAUTH_STATE_MAX_AGE_S = 10 * 60;
export const OAUTH_CALLBACK_PATH = "/api/instagram/oauth/callback";

/** Machine-readable failure reasons surfaced to the settings page as `?error=<code>`. */
export type OAuthErrorCode =
  | "missing_app_credentials"
  | "access_denied"
  | "invalid_state"
  | "missing_code"
  | "token_exchange_failed"
  | "profile_fetch_failed"
  | "no_instagram_account"
  | "multiple_instagram_accounts";

export class OAuthFlowError extends Error {
  override readonly name = "OAuthFlowError";
  constructor(
    readonly code: OAuthErrorCode,
    readonly cause?: unknown,
  ) {
    super(code);
  }
}

/** The redirect URI registered in the Meta app dashboard. */
export function oauthRedirectUri(): string {
  return `${appUrl()}${OAUTH_CALLBACK_PATH}`;
}

/* ---------------------------------- state ---------------------------------- */

function signState(state: string): string {
  return createHmac("sha256", deriveKey("session")).update(`ig-oauth:${state}`).digest("base64url");
}

/** New CSRF state: `state` goes to Meta's authorization dialog, `cookieValue` into an httpOnly cookie. */
export function createOAuthState(): { state: string; cookieValue: string } {
  const state = randomToken(32);
  return { state, cookieValue: `${state}.${signState(state)}` };
}

/** Timing-safe check that the returned `state` matches the signed cookie. */
export function verifyOAuthState(returnedState: string | null, cookieValue: string | undefined): boolean {
  if (!returnedState || !cookieValue) return false;
  const dot = cookieValue.lastIndexOf(".");
  if (dot <= 0) return false;
  const state = cookieValue.slice(0, dot);
  const sig = cookieValue.slice(dot + 1);
  return safeEqual(sig, signState(state)) && safeEqual(state, returnedState);
}

/* ---------------------------------- flow ----------------------------------- */

async function getAppCredentials(): Promise<{ appId: string; configId: string; appSecret: string }> {
  const [settings, appSecret] = await Promise.all([getMetaAppSettings(), getMetaAppSecret()]);
  const appId = settings.metaAppId;
  const configId = settings.metaConfigId;
  if (!appId || !configId || !appSecret) throw new OAuthFlowError("missing_app_credentials");
  return { appId, configId, appSecret };
}

/** Builds the Meta Unified Login authorization URL. Scopes are selected by config_id. */
export async function buildAuthorizeUrl(state: string): Promise<string> {
  const { appId, configId } = await getAppCredentials();
  return buildUnifiedLoginAuthorizeUrl({
    appId,
    configId,
    redirectUri: oauthRedirectUri(),
    state,
  });
}

/** Account assets the Unified Login system-user token can access. */
const assignedInstagramAccountsSchema = z.object({
  data: z.array(z.object({ id: graphId, username: z.string().optional() })),
});

const profileSchema = z.object({
  id: graphId,
  username: z.string().min(1),
  name: z.string().optional(),
  profile_picture_url: z.string().optional(),
});

const subscribeSchema = z.object({ success: z.boolean().optional() });

export interface ConnectResult {
  account: InstagramAccount;
  /** False when the account was saved but the webhook subscription failed (retryable). */
  subscribed: boolean;
}

/**
 * Completes the Unified Login flow: code -> Meta access token -> assigned Instagram asset,
 * stores the encrypted token and subscribes the app to `comments` webhooks. Throws {@link OAuthFlowError}.
 */
export async function completeOAuth(rawCode: string): Promise<ConnectResult> {
  const { appId, appSecret } = await getAppCredentials();
  // Meta may append a fragment marker to the returned code; strip it if it leaked into the value.
  const code = rawCode.replace(/#_$/, "");

  // Unified Login returns a Business Integration System User token directly. It does not use
  // the Instagram Login short-token -> ig_exchange_token refresh sequence.
  let userToken: z.infer<typeof tokenResponseSchema>;
  try {
    userToken = await graphRequest({
      method: "GET",
      path: UNIFIED_LOGIN_TOKEN_URL,
      query: {
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: oauthRedirectUri(),
        code,
      },
      schema: tokenResponseSchema,
      retries: 0,
    });
  } catch (err) {
    throw new OAuthFlowError("token_exchange_failed", err);
  }

  // Resolve the Instagram assets granted to this Meta user before persisting an account token.
  let assigned: z.infer<typeof assignedInstagramAccountsSchema>;
  try {
    assigned = await graphRequest({
      path: "/me/assigned_instagram_accounts",
      accessToken: userToken.access_token,
      schema: assignedInstagramAccountsSchema,
    });
  } catch (err) {
    throw new OAuthFlowError("profile_fetch_failed", err);
  }
  if (assigned.data.length === 0) throw new OAuthFlowError("no_instagram_account");
  if (assigned.data.length > 1) throw new OAuthFlowError("multiple_instagram_accounts");

  const igUserId = assigned.data[0]!.id;
  let profile: z.infer<typeof profileSchema>;
  try {
    profile = await graphRequest({
      path: `/${encodeURIComponent(igUserId)}`,
      query: { fields: "id,username,name,profile_picture_url" },
      accessToken: userToken.access_token,
      schema: profileSchema,
    });
  } catch (err) {
    throw new OAuthFlowError("profile_fetch_failed", err);
  }

  const account = await upsertAccount({
    igUserId: profile.id,
    username: profile.username,
    name: profile.name ?? null,
    profilePictureUrl: profile.profile_picture_url ?? null,
    accessToken: userToken.access_token,
    expiresInSeconds: userToken.expires_in ?? null,
  });

  const status = await subscribeAndRecord(profile.id, userToken.access_token, "connect");
  return { account, subscribed: status.ok };
}

/** Subscribes the app to the account's `comments` and `messaging_postbacks` webhook fields. Returns false on failure. */
export async function subscribeToWebhooks(igUserId: string, accessToken: string): Promise<boolean> {
  return (await subscribeWithDetails(igUserId, accessToken)).ok;
}

/** Webhook fields we subscribe to: comments (engine) and postbacks (follow gate button). */
export const WEBHOOK_SUBSCRIBED_FIELDS = "comments,messaging_postbacks";

const subscribedAppsSchema = z.object({
  data: z.array(z.looseObject({ subscribed_fields: z.array(z.string()).optional() })).optional(),
});

/**
 * `POST /{ig-user-id}/subscribed_apps?subscribed_fields=comments,messaging_postbacks`, then (best-effort)
 * reads back the subscribed fields. Never throws for Graph API errors; the error text is token-free.
 */
export async function subscribeWithDetails(
  igUserId: string,
  accessToken: string,
): Promise<{ ok: boolean; fields?: string[]; error?: string }> {
  try {
    const res = await graphRequest({
      method: "POST",
      path: `/${encodeURIComponent(igUserId)}/subscribed_apps`,
      query: { subscribed_fields: WEBHOOK_SUBSCRIBED_FIELDS },
      accessToken,
      schema: subscribeSchema,
      idempotent: true,
    });
    if (res.success === false) return { ok: false, error: "Instagram answered success: false" };
  } catch (err) {
    if (err instanceof GraphApiError) return { ok: false, error: safeErrorMessage(err, [accessToken], 300) };
    throw err;
  }
  try {
    const current = await graphRequest({
      path: `/${encodeURIComponent(igUserId)}/subscribed_apps`,
      accessToken,
      schema: subscribedAppsSchema,
      retries: 0,
      timeoutMs: 5_000,
    });
    const fields = [...new Set((current.data ?? []).flatMap((d) => d.subscribed_fields ?? []))].slice(0, 20);
    return { ok: true, fields };
  } catch {
    return { ok: true };
  }
}

/** Subscribes and persists the outcome in the `webhook.subscription` setting (best-effort). */
export async function subscribeAndRecord(
  igUserId: string,
  accessToken: string,
  source: SubscriptionStatus["source"],
): Promise<SubscriptionStatus> {
  const result = await subscribeWithDetails(igUserId, accessToken);
  const status: SubscriptionStatus = {
    ok: result.ok,
    at: new Date().toISOString(),
    source,
    ...(result.fields ? { fields: result.fields } : {}),
    ...(result.error ? { error: result.error } : {}),
  };
  try {
    await setSetting("webhook.subscription", status);
  } catch (err) {
    log.warn("webhook.subscription_record_failed", { err: safeErrorMessage(err) });
  }
  log.info("webhook.subscribed", { ok: status.ok, source, fields: status.fields });
  return status;
}
