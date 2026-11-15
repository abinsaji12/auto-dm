# Meta (Instagram Unified Login) setup guide

This guide connects one Instagram Professional account (Business or Creator) to your AutoDM deployment using Meta's **Unified Login** flow. It is written for the new Meta app setup that uses a **Facebook Login for Business configuration and a `config_id`**.

> **Important:** Do not follow older tutorials that ask you to copy an Instagram-specific App ID/App Secret, use `graph.instagram.com`, or add `instagram_business_*` scopes. This version of AutoDM uses the **Meta App ID**, **Meta App Secret**, and **Unified Login Config ID** from the Meta app.

Meta changes its dashboard labels often. If a menu has moved, look for the equivalent **Manage messaging & content on Instagram**, **API setup with Unified Login**, or **Facebook Login for Business → Configurations** section.

## What you need first

- An Instagram **Professional account** (Business or Creator). Personal accounts must be switched first.
- A **Meta Business Portfolio** that owns or has access to the Instagram professional account. The app itself must be associated with a Business Portfolio for the Unified Login setup.
- A Facebook/Meta account that can access that Business Portfolio and the Instagram account.
- In Instagram, turn on **Allow access to messages**: _Settings → Messages and story replies → Message controls → Connected tools → Allow access to messages_.
- AutoDM deployed on a public **HTTPS** URL, and the initial AutoDM admin password changed.
- You do **not** need to connect a Facebook Page for this Unified Login flow.

Throughout, `{APP_URL}` is your public URL, for example `https://my-autodm.vercel.app` (no trailing slash).

| Value | Where to get it | Where it is used |
| --- | --- | --- |
| Meta App ID | Meta app → **App settings → Basic** | AutoDM → **Settings → Instagram** |
| Meta App Secret | Meta app → **App settings → Basic** → Show | AutoDM → **Settings → Instagram**, or server env `META_APP_SECRET` |
| Unified Login Config ID | **Facebook Login for Business → Configurations** | AutoDM → **Settings → Instagram** |
| OAuth redirect URI | Copy from AutoDM → **Settings → Instagram** | The Unified Login configuration's redirect URI list |
| Webhook callback URL | `{APP_URL}/api/webhooks/instagram` | Meta → Instagram Webhooks |
| Verify token | Copy from AutoDM → **Settings → Instagram → Webhook** | Meta → Instagram Webhooks |

## Part 1 - Create and prepare the Meta app

1. Open <https://developers.facebook.com/apps> and sign in.
2. Create a **Business** app. When prompted for a use case, choose **Manage messaging & content on Instagram** (or the closest Instagram messaging/content use case Meta offers).
3. Make sure the app is owned by or connected to the **Business Portfolio** that will share the Instagram account. If Meta asks you to select a portfolio, select the one that has access to your Instagram professional account.
4. Open the Instagram use case and select **Customize**. Find **API setup with Unified Login**. Depending on the dashboard layout, this may appear under **Use cases → Manage messaging & content on Instagram → Customize**.
5. If Facebook Login for Business is not already available, add it from **Add products**.

## Part 2 - Create the Unified Login configuration

The configuration controls which assets and permissions are shared. AutoDM reads the configuration's `config_id`; it does not send a separate `scope` list in the authorization URL.

1. Open **Facebook Login for Business → Configurations** and choose **Create configuration**.
2. Choose the **General** login variation if Meta asks.
3. Choose **System-user access token** (sometimes shown as **System User Access Token / SUAT**). The AutoDM integration uses the Business Integration System User token returned by this flow.
4. Under business assets, select the Instagram Professional account that AutoDM should manage. Set the Instagram account as required if that option is shown.
   - AutoDM currently supports **one connected Instagram account per installation**. Share exactly one Instagram account with this configuration. If the authorization returns zero or multiple accounts, AutoDM will refuse to connect and show an explanatory error.
   - The selected Instagram account must be accessible from the Business Portfolio and the Meta user completing authorization.
5. Add these permissions to the configuration:

   | Permission | Used by AutoDM |
   | --- | --- |
   | `instagram_basic` | Read the connected account's identity and media |
   | `instagram_manage_comments` | Read comments and publish public comment replies |
   | `instagram_manage_messages` | Send Instagram private replies / DMs |
   | `business_management` | Allows the returned business integration token to discover the Instagram asset shared with the Business Portfolio. |

   Add `business_management` to the same configuration as well. In some Meta dashboards it only appears after adding the **Facebook Login for Business** product to the app and editing the configuration there. A number of new Unified Login integrations receive an empty `/me/assigned_instagram_accounts` response without it. Meta may require the relevant access level for this permission and `public_profile`; follow the status in your App Review dashboard.

   Use these Unified Login permission names. Do not substitute the older Instagram Login names beginning with `instagram_business_`.
6. Check the configuration includes `business_management` in addition to the three Instagram permissions above. This is used by AutoDM to enumerate the Instagram asset returned by the business authorization. Save and re-open the configuration once to ensure the permission persisted.

7. Choose the token expiration supported by your configuration:
   - **Never** is the simplest option when available; AutoDM leaves non-expiring tokens alone.
   - If you choose an expiring token (for example, 60 days), AutoDM's daily cron attempts to refresh it when fewer than 15 days remain. The cron must be running and `CRON_SECRET` must be configured.
8. Save the configuration, select **Use this configuration** if Meta shows that action, and copy its **Configuration ID**. This is the **Unified Login Config ID** you will enter in AutoDM.

## Part 3 - Save the Meta app credentials in AutoDM

1. In Meta, open **App settings → Basic**.
2. Copy the general **App ID** and **App Secret** from that page. Click **Show** to reveal the secret.
   - Use the Meta app's App ID and App Secret from **App settings → Basic**.
   - Do not use an old Instagram-specific App ID or Instagram App Secret from the legacy Instagram Login setup.
3. In AutoDM, open **Settings → Instagram → Meta app**.
4. Enter:
   - **Meta App ID**
   - **Unified Login Config ID**
   - **Meta App Secret**
5. Click **Save credentials**. The secret is write-only and stored encrypted; it is never shown again.
   - Alternatively, set the server-only environment variable `META_APP_SECRET`. When set, it takes precedence over the encrypted fallback saved in the UI.
6. Copy the **OAuth redirect URI** displayed on the same card. It will look like:
   `{APP_URL}/api/instagram/oauth/callback`.

## Part 4 - Register the OAuth redirect URI

1. Open **Facebook Login for Business → Configurations** and edit the configuration used by AutoDM.
2. Add the exact OAuth redirect URI copied from **Settings → Instagram** to that configuration's redirect URI list. If Meta exposes the shared **Facebook Login for Business → Settings → Valid OAuth Redirect URIs** list instead, add it there.
3. Save the configuration.

The redirect URI must match exactly: HTTPS in production, same hostname, same path, and no extra trailing slash. Add separate entries for each deployment URL you intend to use (production and preview).

## Part 5 - Grant test-user and business-asset access

1. Make sure the Meta account that will authorize AutoDM has access to the Business Portfolio and the Instagram professional account selected in the configuration.
2. While the app is in **Development mode**, add the authorizing Meta account as an app Admin, Developer, or Tester under **App roles**, as required by the Meta dashboard.
3. If Meta presents an Instagram Tester invitation for the Instagram account, accept it in Instagram under **Settings → Website permissions → Apps and websites → Tester invites**.
4. Confirm that the Instagram account is still Professional and that **Allow access to messages** is ON.

## Part 6 - Connect Instagram in AutoDM

1. Open AutoDM → **Settings → Instagram**.
2. Confirm the Meta App ID, Config ID, and App Secret are marked as configured.
3. Click **Connect Instagram**. Meta's authorization window opens on a Facebook-hosted domain because this new-app integration must use Unified Login.
4. In the Meta window, choose **Continue with Instagram** (not **Continue with Facebook**) and sign in using the Instagram username/password for the account you want to connect. The app sends `prompt=login` to ask Meta to show the Instagram/Facebook sign-in choices even when a Facebook session already exists.
5. After Instagram sign-in, choose the correct Business Portfolio and share the single Instagram Professional account configured for AutoDM, then approve the requested access.

AutoDM exchanges the authorization code on the server, requests the Instagram assets assigned to the authorized business user, and resolves the Instagram account profile. The token is encrypted in the database. If the dialog succeeds but AutoDM reports **No Instagram account** or **Multiple Instagram accounts**, edit the configuration and asset sharing, then connect again.

After a successful connection, your Instagram username appears in Settings. AutoDM also attempts to subscribe the connected account to the `comments` and `messaging_postbacks` webhook fields; check **Webhook diagnostics** if the subscription fails.

## Part 7 - Configure Instagram webhooks

1. In the Meta dashboard open **Use cases → Manage messaging & content on Instagram → Customize → API setup with Unified Login** (or the equivalent Instagram Webhooks setup page).
2. Open the webhook configuration. Set **Callback URL** to:
   `{APP_URL}/api/webhooks/instagram`
3. Copy the **Verify token** from AutoDM → **Settings → Instagram → Webhook**.
4. Click **Verify and save**.
5. Subscribe to:
   - `comments` - required for comment automation.
   - `messaging_postbacks` - required for the optional follow-gate button.
6. Return to AutoDM. **Settings → Instagram → Webhook diagnostics** shows recent webhook requests and account subscription status. Use **Re-subscribe webhooks** if the account-level subscription needs to be retried.
7. Test from a second Instagram account that is permitted to use the app in Development mode. Your connected account's own comments are ignored.

If you use n8n as a relay, configure Meta's callback URL to the n8n production webhook URL instead. See [n8n.md](n8n.md).

## Part 8 - Development mode, Live mode, and App Review

In Development mode, only people with an app role or tester access can authorize and test the app. For public commenters, Meta may require the app to be Live and the relevant permissions to have **Advanced Access**.

Before switching to Live, AutoDM provides the URLs Meta asks for:

1. In AutoDM open **Settings → Account → Public contact** and enter your name or business name and a contact email.
2. In **Settings → Instagram → Meta app review**, copy the URLs:
   - Privacy Policy: `{APP_URL}/privacy`
   - Terms of Service: `{APP_URL}/terms`
   - Data deletion instructions: `{APP_URL}/data-deletion`
   - Deauthorize callback: `{APP_URL}/api/instagram/deauthorize`
   - Data deletion request callback: `{APP_URL}/api/instagram/data-deletion`
3. Paste the privacy, terms, and data-deletion instructions URLs into **App settings → Basic**.
4. Put the deauthorize and data-deletion callback URLs into the corresponding callback fields in the Unified Login / Instagram setup settings.
5. These signed-request callbacks use the **Meta App Secret** from App settings → Basic. Ensure the same secret is configured in AutoDM.
6. In **App Review → Permissions and features**, request Advanced Access for the permissions required by your use case:
   - `instagram_basic`
   - `instagram_manage_comments`
   - `instagram_manage_messages`
7. Provide Meta's requested screencast, reviewer instructions, privacy policy, and Business Verification details. Then switch the app to **Live** when Meta allows it.
8. Test a comment from an account that is not an app tester and verify that it appears in AutoDM Activity.

Meta's requirements can vary by app type, permission, and account ownership. Use the access-level status shown in your own Meta dashboard as the source of truth; public webhook delivery may require Advanced Access/App Review.

### Handling a commenter's data-deletion request

People who only comment on your posts do not sign in to AutoDM, so Meta may not send a user-initiated deletion callback for them. The public `/data-deletion` page tells them how to contact you. To process such a request, delete the commenter's data from **Activity** or **Settings → Account → Delete a commenter's data** and provide the confirmation link.

## Part 9 - Private Reply rules and limits

- **One private reply per comment**, within **7 days** of the comment (Live comments are limited to the active broadcast).
- AutoDM uses the Instagram private-reply API with the comment ID as the recipient reference.
- A follow-up message is only possible if the user replies and opens the standard messaging window.
- Keep DM text at or below AutoDM's 1000-character limit.
- A link button uses a template message; if Meta rejects that format, AutoDM falls back to a text message containing the URL.
- The optional follow gate sends a postback button. Meta must deliver `messaging_postbacks` webhooks for the follow-up to be processed.
- Meta rate limits and spam enforcement still apply. Only send relevant replies to people who commented on your post.

## Part 10 - Access-token lifetime

The access-token lifetime comes from the Unified Login configuration:

- **Non-expiring configuration:** Meta may omit `expires_in`; AutoDM stores no expiry timestamp and does not attempt a refresh.
- **Expiring configuration:** AutoDM stores the returned expiry. Its daily cron refreshes the token when fewer than 15 days remain, using the Meta app credentials. Configure `CRON_SECRET` and make sure the cron endpoint runs.
- If an expiring token is already expired or the refresh fails, reconnect Instagram from **Settings → Instagram**.

The browser authorization window is hosted at `facebook.com` because Meta requires Unified Login for newly created Instagram messaging apps. This does not mean you must authenticate as a Facebook user: choose **Continue with Instagram** to use Instagram credentials. The app keeps the `config_id`-based Unified Login flow; it does not use the legacy `instagram.com/oauth/authorize` endpoint, which rejects new Meta apps. The Unified Login Graph API calls use `graph.facebook.com`; this differs from the old Instagram Login flow that used `graph.instagram.com` and the separate 60-day Instagram User token-refresh endpoint.

## Is it free and unlimited?

AutoDM has no per-contact or per-message fee. Meta API access, review requirements, rate limits, hosting quotas, and account enforcement are controlled by Meta and your hosting provider. The app itself does not impose a keyword or campaign contact limit.

## Quick checklist

- [ ] Instagram account is Professional (Business or Creator).
- [ ] Instagram **Allow access to messages** is ON.
- [ ] The Instagram account is accessible from the Business Portfolio.
- [ ] Meta app is associated with the correct Business Portfolio.
- [ ] Facebook Login for Business configuration uses a **System-user access token**.
- [ ] Exactly one Instagram account is shared with the configuration.
- [ ] Configuration includes `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`, and `business_management`.
- [ ] Meta App ID + Unified Login Config ID + Meta App Secret are saved in AutoDM.
- [ ] OAuth redirect URI from AutoDM is registered exactly in the configuration.
- [ ] Connect Instagram succeeds and the correct username appears.
- [ ] Webhook callback URL and verify token are saved in Meta; `comments` is subscribed.
- [ ] `messaging_postbacks` is subscribed if you use the follow gate.
- [ ] Public contact and Meta review URLs are configured before going Live.
- [ ] Advanced Access/App Review is completed if Meta requires it for public access or `business_management`.

## References

- [Meta Instagram Platform overview](https://developers.facebook.com/docs/instagram-platform/overview/)
- [Meta Instagram Webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-instagram/)
- [Meta User Assigned Instagram Accounts edge](https://developers.facebook.com/docs/graph-api/reference/user/assigned_instagram_accounts/)
- [Meta Facebook Login for Business](https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/)
- [Meta Instagram Platform changelog](https://developers.facebook.com/docs/instagram-platform/changelog/)
