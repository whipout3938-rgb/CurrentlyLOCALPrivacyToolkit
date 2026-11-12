# PrivacyToolkit — Vencord userplugin

A collection of privacy-focused utilities for Vencord. PrivacyToolkit provides best-effort detection, alerts, local message redaction, group-DM controls, and optional local call recording. It is **not** a guarantee that personal information cannot be exposed. Feedback is recommended, it helps with development.

## Features

- Incoming and outgoing message scanning for common personal-information patterns.
- Best-effort local redaction of detected text in visible messages and outgoing message content.
- Custom protected terms and user-supplied IPv4/IPv6 values.
- Local matching for a short list of known IP-logging links. The list is incomplete and does not resolve redirects.
- Alerts when a message combines multiple personal-data signals.
- **ImageGuard**: automatic pre-upload checks plus a manual chat-bar scan for pending images. It checks EXIF/GPS metadata, visible text with on-device OCR where supported, and QR payloads where BarcodeDetector is available.
- **OPSEC Center**: six defensive modules for identity compartmentalization, metadata, links, digital footprint, account security, and exposure response.
- **App Authorization Guard**: pauses recognizable Discord OAuth2 authorization links inside the client and shows requested email/identity scopes, sensitive account/server scopes, bot installation, and privileged bot permissions before the user chooses to continue.
- Local link warnings for common tracking parameters, suspicious IP-logging domains, and public social-profile URLs.
- Group-DM auto-leave with a trusted-channel allowlist. This reacts after Discord adds the account and cannot prevent the initial server-side addition.
- Optional GitHub Releases update notifications. The checker notifies only; updating still requires replacing source, rebuilding Vencord, injecting, and restarting.
- Consent-gated local call recorder with an Arm Call action, visible recording timer, stop control, and three audio-only WebM outputs: combined, microphone-only, and desktop/system-audio-only.

## Important limitations

- App Authorization Guard only covers recognizable Discord OAuth2 authorization links and buttons handled inside the Vencord client. It cannot reliably intercept external-browser flows, other devices, direct app authorization paths, or nonstandard OAuth implementations. It reports requested scopes and permissions; it cannot inspect the app developer's private data-handling practices or prevent data use after authorization.
- ImageGuard depends on Vencord's current `uploadFiles` path for automatic scanning. If Discord changes that internal method, the upload patch may stop applying; the manual scan button is available as a fallback.
- OCR and QR scanning depend on experimental/browser APIs exposed by the user's Discord/Electron build. Unsupported checks are reported as unavailable. OCR cannot identify every visual clue, face, landmark, reflection, or background detail.
- ImageGuard inspects the original local file before upload. It warns by default and does not strip metadata, blur pixels, or rewrite images. Optional blocking removes flagged images from the pending draft.
- EXIF detection is heuristic and may miss unusual metadata layouts. A clean scan is not a safety guarantee.
- Detection is heuristic and may miss information or produce false positives. Incoming DOM redaction is best-effort; Discord re-renders, embeds, accessibility views, quoted messages, and other plugins may expose unredacted content.
- PrivacyToolkit does not retrieve or collect anyone's IP address.
- Group-DM protection cannot stop the initial server-side addition and may leave a brief exposure window. The Discord request may also fail.
- Desktop/system audio capture depends on Discord/Electron/Windows support and the system-audio option selected in the capture picker. It may capture unrelated sounds and notifications. If an audio track is unavailable, the recorder should not be treated as a full call recording.
- The call recorder requires the user to notify participants and obtain their agreement before recording. The confirmation is not proof of consent and does not determine what recording laws apply.
- Audio is saved locally; no recording upload service is used by this feature. Default save destination follows the browser/Electron download setting (usually Downloads). A custom folder is available where Chromium's directory picker is supported.
- The updater only checks the latest stable GitHub Release. It does not silently replace plugin code or rebuild Vencord.
- Treat the plugin as experimental until the compatibility workflow and your own Vencord/Discord client tests have completed. A successful build does not prove every runtime hook or browser API is available.
- PrivacyToolkit can reduce accidental disclosure through local warnings and best-effort redaction, but it cannot guarantee that personal information will not be shared. 
## Download

The published **v2.2.1** pre-release contains the earlier PrivacyToolkit build. The **v2.5.0** App Authorization Guard, ImageGuard, and OPSEC Center tester pre-release has passed the automated Vencord type-check and build. The release workflow repeats those checks before publishing; the build still requires real-client testing by users.

- [Published releases](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/releases)
- [Download the current main-branch source archive for testing](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/archive/refs/heads/main.zip)

The 2.3.0 Exposure Guard, 2.4.0 ImageGuard/OPSEC Center, and 2.5.0 App Authorization Guard changes are committed to `main`. Check the release page for the tester build after the release workflow completes. To preview them, extract the main-branch source archive and copy `src/userplugins/privacytoolkit/` into your Vencord checkout. Build and test it locally before using it as a daily release.

## Install

1. Fully quit Discord.
2. Move any folder containing an older copy of this plugin out of `Vencord/src/userplugins/` as a backup. Do not keep two copies active.
3. Extract `privacytoolkit.zip` and copy its `privacytoolkit/` folder into `Vencord/src/userplugins/privacytoolkit/`.
4. From the Vencord repository root, run `pnpm build`.
5. Run `pnpm inject`, restart Discord, and enable **PrivacyToolkit** under **User Settings → Vencord → Plugins**.
6. Review the settings after the rename. Custom terms, protected IPs, trusted group IDs, and the update repository may need to be entered again.

See the [Vencord custom plugin guide](https://docs.vencord.dev/installing/custom-plugins/).

## App Authorization Guard

App Authorization Guard defaults to enabled. When a standard Discord OAuth2 authorization link is clicked inside the Discord client, it inspects the URL's requested scopes and bot permission bitfield. For sensitive requests it pauses the original click and displays a confirmation showing the requested data and capabilities. Cancel stops the authorization link from opening; Continue anyway replays the original click.

It warns about the `email` scope, account identity, connected accounts, server membership, message-related scopes, bot installation, server channel visibility, and privileged bot permissions such as Administrator, Manage Server, Manage Roles, Manage Channels, Manage Webhooks, and View Audit Log. Each category can be disabled in plugin settings.

**Limitations:** The guard covers recognizable Discord OAuth2 authorization links and authorize buttons handled inside the client. It cannot reliably intercept authorizations completed in an external browser, on another device, through direct/nonstandard flows, or after Discord changes its UI. Requested scopes and permissions do not reveal what an app will store or log. Data a bot legitimately receives may be retained or copied by its operator; the plugin cannot verify the developer's practices or prevent data use after authorization.

## ImageGuard

ImageGuard defaults to **both** automatic and manual scanning. Automatic scanning uses Vencord's pending upload objects to inspect the original local `File` before upload begins. The manual shield button appears beside the message composer while image attachments are pending. The scanner checks for EXIF/GPS metadata, visible text using `TextDetector` where available, and QR payloads using `BarcodeDetector` where available.

By default, ImageGuard only warns. The optional **Block image uploads with findings** setting removes flagged files from the pending message draft; it does not delete the original file from disk. If the current Discord/Electron build does not expose OCR or QR APIs, the scanner reports that those checks were unavailable. It never reports unavailable checks as clean.

ImageGuard does not upload images to external services, does not silently edit image pixels, and does not currently strip metadata or blur detected regions. Review images manually for maps, landmarks, reflections, screens, notifications, and other visual clues.

## OPSEC Center

OPSEC Center includes six optional guidance modules, all enabled by default:

1. Identity compartmentalization
2. Metadata protection
3. Link privacy and tracking parameters
4. Digital-footprint review
5. Account-security audit
6. Exposure response

The modules are defensive checklists and local warnings. They do not scrape other people, query OSINT services, or make accounts untraceable.

## Exposure Guard

Exposure Guard adds local warnings intended to reduce accidental identity linking through Discord messages. It:

- Uses the local **Custom protected terms** list for usernames/handles reused elsewhere, aliases, names, locations, schools, employers, and other identifiers you choose.
- Recognizes links to common public profile paths on services such as Instagram, TikTok, X, Reddit, GitHub, Twitch, YouTube, Steam, Threads, Facebook, and LinkedIn. These links are flagged for review rather than automatically removed.
- Optionally detects your current Discord numeric user ID so it can be flagged if you accidentally paste it into a message.
- Warns when a message combines multiple personal-data signals or pairs a profile link with another identifying clue.
- Runs before message send and edit. Existing redaction can replace configured sensitive terms; optional **Block high-risk messages** holds a draft when a high-risk combination is found.
- Adds a privacy checklist in the plugin's settings About section.

Exposure Guard does **not** perform web searches, reverse-image searches, data-broker lookups, or OSINT scans. It cannot stop another person from searching for information that is already public, prevent username correlation on external websites, or hide Discord metadata that Discord itself still makes visible. It only helps detect clues you are about to share in Discord. A social-profile link by itself is warned about but is not redacted. The detector is heuristic and may miss links or produce false positives.

### Manual privacy steps

These controls belong to Discord, Google, and data-broker websites; PrivacyToolkit does not modify those services' private settings or submit removal requests:

1. **Discord Profile Privacy:** In User Settings → Data & Privacy → Profile Privacy, consider **Friends Only**. Discord says the avatar, banner, display name, username, server tag, account age, and mutual friends/servers remain visible.
2. **Friend requests:** In User Settings → Content & Social → Friend Requests, disable the request categories you do not want. Disabling all three categories prevents requests from Everyone, Friends of Friends, and Server Members.
3. **Server DMs:** In Content & Social → Social Permissions, disable DMs from server members and apply the change to existing servers when offered. Review individual server privacy settings as well.
4. **Activity Sharing:** Review Activity Privacy separately; Profile Privacy does not automatically control every activity-sharing choice.
5. **Google Search:** Use [Results about you](https://myactivity.google.com/results-about-you) to monitor and request removal of eligible results containing personal contact details or government ID information. This removes eligible Search results, not the original webpage.
6. **People-search sites:** Follow the [FTC opt-out guide](https://consumer.ftc.gov/articles/what-know-about-people-search-sites-sell-your-information) and submit opt-outs directly to data-broker sites. Public records may remain available, and information can reappear.
7. Avoid reusing the same usernames, avatars, bios, or contact details across unrelated accounts. Add any aliases you still use to the local Custom protected terms list so the plugin can warn when they appear in Discord messages.

Review Vencord's own settings-sync controls before storing highly sensitive watchlist values. PrivacyToolkit does not send the watchlist to an OSINT lookup service.

## Quick authorization-guard test

Use a **fake client ID** so the test cannot authorize a real app. With PrivacyToolkit enabled, post one of these links in a private test channel or DM and click it:

- Email + identity scope: `https://discord.com/oauth2/authorize?client_id=000000000000000001&scope=identify%20email`
- Bot + Administrator permission: `https://discord.com/oauth2/authorize?client_id=000000000000000001&scope=bot&permissions=8`

Expected result: PrivacyToolkit should show its warning before Discord opens the authorization flow. Choose **Cancel authorization** to verify the link is stopped. Choosing **Continue anyway** should only reach Discord's invalid/fake application response because the client ID is intentionally not real. Do not replace the fake ID with a real app ID for this test.

## Public beta testing

PrivacyToolkit has an open **desktop Vencord beta** using the [v2.5.0 pre-release](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/releases/tag/v2.5.0). It is experimental and does not guarantee that personal information will be detected or protected.

- [Read the public beta testing guide](docs/BETA_TESTING.md) for safe test cases, known issues, and platform status.
- [Report a bug or false positive](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/issues/new?template=bug_report.yml).
- [Request a feature](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/issues/new?template=feature_request.yml).

**Platform status:** Desktop Vencord is open for beta testing. The Kettu mobile MVP is still under review and needs real-device validation; iPhone has no confirmed maintained non-jailbreak loader. Meta Quest is not supported. Do not jailbreak a device or install abandoned loaders to participate.

The v2.5.0 pre-release has a known IPv6/video-timestamp false-positive issue. Until [PR #1](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/pull/1) is merged and released, disable Detect IPv6 for routine use or test that issue separately.

Never submit real personal information, private messages, credentials, unredacted screenshots, personal photos, or call recordings. Use synthetic examples and sanitized logs only. Recording tests require every participant's informed agreement.

## Feedback and tester reports

Use [GitHub Issues](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/issues/new/choose) to send feedback directly to the PrivacyToolkit makers. Include the plugin version, Vencord build date, reproduction steps, and error text. Do not post real personal information, Discord tokens, private recordings, or unredacted images.

## Configure update notifications

Set **GitHub release repository** to `whipout3938-rgb/CurrentlyLOCALPrivacyToolkit`. The checker looks for stable releases on startup and every 24 hours. Once a stable release exists, it can notify you of newer versions. You must still manually replace the plugin source, rebuild Vencord, inject the build, and restart Discord.

## Publishing

GitHub Actions packages the installable source as **`privacytoolkit.zip`** and creates a GitHub Release. Pushing a `v*` tag runs the workflow; maintainers can also run it manually from the Actions tab.

## License

GPL-3.0-or-later. See [GNU General Public License](https://www.gnu.org/licenses/gpl-3.0.html).

## Project status

This is a community-style Vencord userplugin project, not an official Discord or Vencord feature. Contributions and bug reports are welcome. Please avoid posting real personal information, private call recordings, tokens, or other secrets in issues.
