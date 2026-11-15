import "server-only";

/**
 * Instagram API with Meta Unified Login uses Facebook Graph API for OAuth and account requests.
 *
 * Graph API version: v25.0 was released 2026-02-18 (v26.0 on 2026-07-29). We pin to v25.0,
 * a version with a long support window that every endpoint used here supports. Bump deliberately
 * after reading https://developers.facebook.com/docs/graph-api/changelog/versions
 */
export const GRAPH_API_VERSION = "v25.0";
export const GRAPH_HOST = "https://graph.facebook.com";
export const GRAPH_BASE_URL = `${GRAPH_HOST}/${GRAPH_API_VERSION}`;

/** Unified Login authorization-code exchange. Uses the same supported Graph API version as all Graph calls. */
export const UNIFIED_LOGIN_TOKEN_URL = `${GRAPH_BASE_URL}/oauth/access_token`;

/** Meta limit for Private Reply / DM text. */
export const DM_MAX_CHARS = 1000;
/** Button template `text` limit (Messenger Platform templates). */
export const BUTTON_TEMPLATE_TEXT_MAX = 640;
/** Button title limit. */
export const BUTTON_TITLE_MAX = 20;
/** Instagram caption/comment limit. */
export const COMMENT_MAX_CHARS = 2200;
