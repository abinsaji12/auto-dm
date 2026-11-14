# Deployment: from zero to the first automatic DM

This is the complete path, in order. Each step says **where** you do it, **what** to click, and **how
you know it worked**. Plan 30–60 minutes. Everything here is free.

> Bahasa Indonesia: [panduan-lengkap-id.md](panduan-lengkap-id.md) (same steps).

| #   | Step                                                   | Where                   | Done when                                   |
| --- | ------------------------------------------------------ | ----------------------- | ------------------------------------------- |
| 1   | [Create the database](#1-create-the-database)          | Supabase                | You have two connection strings             |
| 2   | [Generate two secrets](#2-generate-two-secrets)        | Your terminal           | You have `APP_SECRET` and `CRON_SECRET`     |
| 3   | [Deploy the app](#3-deploy-the-app)                    | Vercel                  | Build log shows `[migrate] Database is up…` |
| 4   | [Check it is alive](#4-check-it-is-alive)              | Browser                 | `/api/health` says `"status":"ok"`          |
| 5   | [First login](#5-first-login)                          | The app                 | You set your own password                   |
| 6   | [Prepare Instagram](#6-prepare-your-instagram-account) | Instagram app           | Professional account, message access on     |
| 7   | [Create the Meta app](#7-create-the-meta-app)          | developers.facebook.com | App ID + secret saved in the app            |
| 8   | [Connect Instagram](#8-connect-instagram)              | The app                 | Your username shows in Settings             |
| 9   | [Connect the webhook](#9-connect-the-webhook)          | Meta dashboard          | "Verify and save" succeeds                  |
| 10  | [Create a campaign](#10-create-a-campaign-and-a-rule)  | The app                 | "Test a comment" matches                    |
| 11  | [Real test](#11-real-test)                             | Instagram               | Activity shows **Sent**                     |
| 12  | [Open it to everyone](#12-open-it-to-everyone)         | Meta dashboard          | App is **Live**                             |

n8n is **optional** and not part of this path. Only set it up after step 11 works, and only if you
want extra steps such as Telegram alerts. See [n8n.md](n8n.md).

---

## 1. Create the database

1. Go to <https://supabase.com> → **New project**. Pick a region close to you (e.g. Singapore).
   Write down the **database password** you choose.
2. When the project is ready, click **Connect** in the top bar → **Connection String** → type **URI**.
3. Copy two strings and replace `[YOUR-PASSWORD]` with your database password:

   | Method                 | Host / port                     | Becomes                 |
   | ---------------------- | ------------------------------- | ----------------------- |
   | **Transaction pooler** | `aws-…pooler.supabase.com:6543` | `DATABASE_URL`          |
   | **Session pooler**     | `aws-…pooler.supabase.com:5432` | `DATABASE_URL_UNPOOLED` |
   - Do **not** use "Direct connection" (`db.<ref>.supabase.co`). On the free plan it is IPv6-only
     and Vercel cannot reach it, so the build fails.
   - If your password contains `@ : / ? #` or spaces, URL-encode them (e.g. `@` → `%40`) or pick a
     password with letters and digits only.

**You do not need to run any SQL.** The tables are created automatically during the Vercel build
(step 3). Already pasted `0000`–`0002` into the SQL editor by hand? That's fine: the build detects
it, marks them as applied and continues (`[migrate] Found tables created by hand…` in the build log).

## 2. Generate two secrets

On macOS/Linux:

```bash
openssl rand -base64 48   # -> APP_SECRET   (sessions + encryption key)
openssl rand -hex 32      # -> CRON_SECRET  (protects the daily token refresh)
```

On Windows, or anywhere with Node.js installed:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"   # APP_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"      # CRON_SECRET
```

Save `APP_SECRET` in a password manager. If it changes later, everyone is logged out and the stored
Meta secret and Instagram token can no longer be decrypted (you would have to enter them again).

## 3. Deploy the app

1. Fork this repository to your GitHub account (or use your own copy).
2. <https://vercel.com/new> → **Import** the repository. Framework is detected as **Next.js**. Leave
   Build Command, Output Directory and Install Command on their defaults.
3. Open **Environment Variables** on the same screen and add:

   | Key                      | Value                                     | Required |
   | ------------------------ | ----------------------------------------- | -------- |
   | `DATABASE_URL`           | Transaction pooler string (port 6543)     | yes      |
   | `DATABASE_URL_UNPOOLED`  | Session pooler string (port 5432)         | yes      |
   | `APP_SECRET`             | from step 2                               | yes      |
   | `CRON_SECRET`            | from step 2                               | yes      |
   | `ADMIN_DEFAULT_PASSWORD` | your first-login password (8+ chars)      | optional |
   | `APP_URL`                | `https://your.domain`, custom domain only | optional |

   Nothing else goes into Vercel. The Meta App ID/secret, Instagram token, webhook verify token and
   n8n API keys are entered **inside the app** later and stored encrypted in the database.

4. Click **Deploy**. In the build log you should see `[migrate] Database is up to date.` followed by
   the Next.js build.

   > **Match the regions, or every page will be slow.** Vercel runs functions in Washington, D.C.
   > (`iad1`) by default. If your Supabase project is elsewhere, every database query crosses the
   > world (~200 ms each, and a page runs a dozen). Set **Vercel → Project → Settings → Functions →
   > Function Region** to the region next to your database, then redeploy:
   >
   > | Supabase region (in the pooler host) | Vercel function region  |
   > | ------------------------------------ | ----------------------- |
   > | `ap-southeast-1` (Singapore)         | `sin1` Singapore        |
   > | `ap-southeast-2` (Sydney)            | `syd1` Sydney           |
   > | `ap-northeast-1` (Tokyo)             | `hnd1` Tokyo            |
   > | `ap-south-1` (Mumbai)                | `bom1` Mumbai           |
   > | `eu-central-1` (Frankfurt)           | `fra1` Frankfurt        |
   > | `eu-west-2` (London)                 | `lhr1` London           |
   > | `us-east-1` (N. Virginia)            | `iad1` Washington, D.C. |
   > | `us-west-1` (N. California)          | `sfo1` San Francisco    |
   >
   > Starting fresh? Create the Supabase project in the region closest to your audience (e.g.
   > Singapore for Indonesia) and pick the matching Vercel region.
   >
   > To check later: **Settings → About → Server** shows the region the app runs in and the measured
   > database latency.

   Optional: turn on **Skew Protection** (Vercel → Project → Settings → Advanced, where your plan
   offers it) so tabs left open during a deploy keep working. Without it AutoDM reloads such a tab
   once by itself and shows "Updated to a new version".

Added or changed a variable after deploying? Vercel does not apply it to the running version:
**Deployments → ⋯ on the latest → Redeploy**.

> Alternative: Vercel → **Storage / Integrations → Supabase** injects `POSTGRES_URL` and
> `POSTGRES_URL_NON_POOLING`, which the app uses as fallbacks. You still add `APP_SECRET` and
> `CRON_SECRET` yourself.

## 4. Check it is alive

Use your **production** domain (Vercel → Project → Domains, e.g. `https://my-replies.vercel.app`).
Preview URLs with long random names are not meant for Meta.

| Open                          | Expect                                                        | If not                                                           |
| ----------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `https://<domain>/api/health` | `{"status":"ok","db":"ok",…}`                                 | `503`: wrong `DATABASE_URL` or password; check Vercel → Logs     |
| `latencyMs` in that response  | under ~50 (refresh once: the first call opens the connection) | 150+: function region doesn't match the database region (step 3) |
| `https://<domain>/`           | Landing page with a **Sign in** button                        | A yellow **Setup needed** box lists the missing variables        |

## 5. First login

1. Click **Sign in**. Username `admin`, password `changeme123` (or your `ADMIN_DEFAULT_PASSWORD`).
2. You are asked to choose a new password (12+ characters). Do this right after deploying: until
   then anyone who knows the default could sign in first.
3. **Settings → Processing → Time zone**: pick yours (e.g. `Asia/Jakarta`) so Analytics days match
   your calendar.

## 6. Prepare your Instagram account

In the Instagram app, with the account that should reply:

1. **Settings → Account type and tools → Switch to professional account** (Creator or Business).
2. **Settings → Messages and story replies → Message controls → Connected tools → Allow access to
   messages: ON**. Without this every DM fails.

## 7. Create the Meta app and Unified Login configuration

Short version below; the full guide is in [meta-setup.md](meta-setup.md).

1. Open <https://developers.facebook.com/apps> and create a **Business** app with the **Manage messaging & content on Instagram** use case.
2. Associate the app with the **Business Portfolio** that has access to the Instagram Professional account. Unified Login requires a Business Portfolio; a Facebook Page is not required for this flow.
3. Open **Use cases → Manage messaging & content on Instagram → Customize → API setup with Unified Login**.
4. Open **Facebook Login for Business → Configurations** and create a configuration:
   - Login variation: **General**, if prompted.
   - Token type: **System-user access token (SUAT)**.
   - Business assets: share exactly **one Instagram Professional account** with this configuration. AutoDM currently supports one connected Instagram account.
   - Permissions: `instagram_basic`, `instagram_manage_comments`, and `instagram_manage_messages`.
   - Token expiry: choose **Never** if available, or an expiring option. AutoDM refreshes expiring tokens daily when fewer than 15 days remain.
5. Save the configuration, select **Use this configuration** if prompted, and copy the **Configuration ID**.
6. In Meta **App settings → Basic**, copy the general **App ID** and **App Secret**. Do not use the legacy Instagram-specific credentials.
7. In AutoDM → **Settings → Instagram**, enter the **Meta App ID**, **Unified Login Config ID**, and **Meta App Secret**, then save. The secret is stored encrypted. You may instead set server-only `META_APP_SECRET`.
8. Copy the OAuth redirect URI displayed in AutoDM Settings and add it exactly to the Unified Login configuration's redirect URI list (or Facebook Login for Business → Settings → Valid OAuth Redirect URIs). Save.
9. The Meta account that authorizes AutoDM must have access to the selected Business Portfolio and Instagram account. In Development mode, add the authorizing person as an app role/tester if Meta requires it.

## 8. Connect Instagram

1. AutoDM → **Settings → Instagram → Connect Instagram**.
2. Sign in through Meta, choose the correct Business Portfolio, and share the one Instagram account selected in the configuration.
3. Approve the requested permissions and return to AutoDM. The username should appear in Settings.

AutoDM exchanges the authorization code, calls `/me/assigned_instagram_accounts`, and resolves the selected Instagram profile. If it finds zero or more than one account, it refuses to connect; fix the asset sharing so exactly one account is available, then reconnect. The access token is stored encrypted.

## 9. Connect the webhook

This tells Meta where to send new comments.

1. Meta → **Use cases → Manage messaging & content on Instagram → Customize → API setup with Unified Login** (or the equivalent Instagram Webhooks setup page).
2. **Callback URL**: copy from AutoDM **Settings → Instagram → Webhook → Callback URL** (`https://<domain>/api/webhooks/instagram`).
3. **Verify token**: copy from the same card.
4. Click **Verify and save**. Subscribe to **`comments`**. Also subscribe to **`messaging_postbacks`** if you use the follow-gate button.
5. Return to AutoDM and check **Webhook diagnostics**. Account-level subscription should show as successful; use **Re-subscribe webhooks** if needed.

The Webhook card in Settings changes from "No events yet" to **Receiving events** after the first comment arrives.

## 10. Create a campaign and a rule

1. **Campaigns → New campaign** → choose a post/reel (or all posts) → save.
2. **Add rule**: keywords (e.g. `drive`), match mode **Whole word**, two or three public reply
   variants (e.g. `Sent to your DMs, {username}!`), and the DM text with your link (max 1000
   characters). Optional link button.
3. Use **Test a comment** to check matching. It sends nothing.

## 11. Real test

While the Meta app is in **Development mode**, only accounts with a role on the app trigger webhooks.

1. Add a **second** Instagram account as Instagram Tester (step 7.7) and accept the invite.
2. From that account, comment your keyword on the post.
3. Within seconds: a public reply appears, the DM arrives, and **Activity** shows the row as **Sent**.

Nothing in Activity? See [troubleshooting.md](troubleshooting.md) → "Webhook does not fire".

## 12. Open it to everyone

To process comments from the public, switch the Meta app to **Live** and, if Meta requires it for
your setup, get **Advanced Access** through App Review.

Before the Live toggle works, Meta needs a privacy policy and data deletion handling. The app
provides both:

1. **Settings → Account → Public contact**: enter your name (or business name) and a contact email.
2. **Settings → Instagram → Meta app review** lists the URLs. Paste the **Privacy Policy URL**
   (`/privacy`), **Terms of Service URL** (`/terms`) and **Data deletion instructions URL**
   (`/data-deletion`) into Meta → **App settings → Basic**, and the **Deauthorize callback URL** and **Data deletion request URL** into
   **Instagram → API setup with Unified Login / Facebook Login for Business settings**.

Steps and the honest state of what Meta requires:
[meta-setup.md → Part 8](meta-setup.md#part-8---development-vs-live-mode-important).

---

## Other hosting: Docker

Run the published image `ghcr.io/ilramdhan/auto-dm` with Docker Compose on any VPS (app,
Postgres and a cron sidecar included). See [docker.md](docker.md).

## Reference

### Cron

`vercel.json` registers a daily call to `/api/cron/refresh-tokens` (Hobby allows one per day). Vercel
sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set; without it the
route refuses calls and the Instagram token expires after ~60 days.

### Custom domain

Vercel → Project → Settings → Domains. Set `APP_URL=https://your.domain`, redeploy, then update the
OAuth redirect URI (step 7.6) and the webhook callback URL (step 9) in Meta.

### Upgrading

GitHub → your fork → **Sync fork** (or `git pull upstream main` and push). Vercel redeploys and applies
new migrations during the build. Read the release notes first and back up the database before a
major version.

Some releases need a one-time step after upgrading; the release notes say so. For example, the
**follow gate** (Require follow) needs the `messaging_postbacks` webhook field: in the Meta App
Dashboard → Webhooks (Instagram) toggle **`messaging_postbacks`** on, then click **Settings →
Instagram → Re-subscribe webhooks** once. Until then everything else keeps working; only the follow
gate button does not respond. See [meta-setup.md](meta-setup.md#part-9---private-reply-rules-what-limits-your-dms).

**Settings → About** shows the running version (plus commit and environment on Vercel), whether a
newer release exists, the latest release notes, and the server region with the database latency. The check calls the public GitHub Releases API
from the server, cached for 6 hours; if GitHub can't be reached it just says so.

### Notes

Supabase Free pauses projects after about a week without activity; the daily cron call keeps it
active. Vercel Hobby is intended for non-commercial use; check Vercel's current terms for business
use.
