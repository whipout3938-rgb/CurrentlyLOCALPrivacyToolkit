# PrivacyToolkit — Vencord userplugin

A collection of privacy-focused utilities for Vencord. PrivacyToolkit provides best-effort detection, alerts, local message redaction, group-DM controls, and optional local call recording. It is **not** a guarantee that personal information cannot be exposed.

## Features

- Incoming and outgoing message scanning for common personal-information patterns.
- Best-effort local redaction of detected text in visible messages and outgoing message content.
- Custom protected terms and user-supplied IPv4/IPv6 values.
- Local matching for a short list of known IP-logging links. The list is incomplete and does not resolve redirects.
- Alerts when a message combines multiple personal-data signals.
- Attachment metadata and image alt-text checks; experimental on-device OCR where supported.
- Group-DM auto-leave with a trusted-channel allowlist. This reacts after Discord adds the account and cannot prevent the initial server-side addition.
- Optional GitHub Releases update notifications. The checker notifies only; updating still requires replacing source, rebuilding Vencord, injecting, and restarting.
- Consent-gated local call recorder with an Arm Call action, visible recording timer, stop control, and three audio-only WebM outputs: combined, microphone-only, and desktop/system-audio-only.

## Important limitations

- Detection is heuristic and may miss information or produce false positives. Incoming DOM redaction is best-effort; Discord re-renders, embeds, accessibility views, quoted messages, and other plugins may expose unredacted content.
- PrivacyToolkit does not retrieve or collect anyone's IP address.
- Group-DM protection cannot stop the initial server-side addition and may leave a brief exposure window. The Discord request may also fail.
- Desktop/system audio capture depends on Discord/Electron/Windows support and the system-audio option selected in the capture picker. It may capture unrelated sounds and notifications. If an audio track is unavailable, the recorder should not be treated as a full call recording.
- The call recorder requires the user to notify participants and obtain their agreement before recording. The confirmation is not proof of consent and does not determine what recording laws apply.
- Audio is saved locally; no recording upload service is used by this feature. Default save destination follows the browser/Electron download setting (usually Downloads). A custom folder is available where Chromium's directory picker is supported.
- The updater only checks the latest stable GitHub Release. It does not silently replace plugin code or rebuild Vencord.
- Treat the plugin as experimental until you have built and tested it against your own Vencord/Discord version.
- The plugin can prevent you from sending personal info to others. 
## Download

Download **`privacytoolkit.zip`** from the [latest GitHub release](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/releases/latest). The archive contains the `privacytoolkit/` plugin folder plus the README, changelog, and license.

## Install

1. Fully quit Discord.
2. Move any folder containing an older copy of this plugin out of `Vencord/src/userplugins/` as a backup. Do not keep two copies active.
3. Extract `privacytoolkit.zip` and copy its `privacytoolkit/` folder into `Vencord/src/userplugins/privacytoolkit/`.
4. From the Vencord repository root, run `pnpm build`.
5. Run `pnpm inject`, restart Discord, and enable **PrivacyToolkit** under **User Settings → Vencord → Plugins**.
6. Review the settings after the rename. Custom terms, protected IPs, trusted group IDs, and the update repository may need to be entered again.

See the [Vencord custom plugin guide](https://docs.vencord.dev/installing/custom-plugins/).

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

## Configure update notifications

Set **GitHub release repository** to `whipout3938-rgb/CurrentlyLOCALPrivacyToolkit`. The checker looks for stable releases on startup and every 24 hours. Once a stable release exists, it can notify you of newer versions. You must still manually replace the plugin source, rebuild Vencord, inject the build, and restart Discord.

## Publishing

GitHub Actions packages the installable source as **`privacytoolkit.zip`** and creates a GitHub Release. Pushing a `v*` tag runs the workflow; maintainers can also run it manually from the Actions tab.

## License

GPL-3.0-or-later. See [GNU General Public License](https://www.gnu.org/licenses/gpl-3.0.html).

## Project status

This is a community-style Vencord userplugin project, not an official Discord or Vencord feature. Contributions and bug reports are welcome. Please avoid posting real personal information, private call recordings, tokens, or other secrets in issues.
