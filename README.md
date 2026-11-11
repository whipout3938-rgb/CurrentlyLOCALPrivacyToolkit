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

## Install

1. Fully quit Discord.
2. In your Vencord checkout, move any older `src/userplugins/antidoxx/` folder outside `src/userplugins/` as a backup. Do not keep both old and new plugin folders active.
3. Copy `src/userplugins/privacytoolkit/` from this repository into `Vencord/src/userplugins/privacytoolkit/`.
4. From the Vencord repository root, run `pnpm build`.
5. Run `pnpm inject`, restart Discord, and enable **PrivacyToolkit** under **User Settings → Vencord → Plugins**.
6. Review the settings after the rename. Custom terms, protected IPs, trusted group IDs, and the update repository may need to be entered again.

See the [Vencord custom plugin guide](https://docs.vencord.dev/installing/custom-plugins/).

## Configure update notifications

Set **GitHub release repository** to `whipout3938-rgb/CurrentlyLOCALPrivacyToolkit`. The checker looks for stable releases on startup and every 24 hours. Once a release exists, it can notify you of newer versions. You must still manually replace the plugin source, rebuild Vencord, inject the build, and restart Discord.

## Publish a release

The GitHub Actions workflow in `.github/workflows/release.yml` packages the installable source and creates a GitHub Release when a tag matching `v*` is pushed. Do not publish a stable release until the source has been built and tested locally. For example:

```bash
git tag v2.2.1
git push origin v2.2.1
```

## License

GPL-3.0-or-later. See [GNU General Public License](https://www.gnu.org/licenses/gpl-3.0.html).

## Project status

This is a community-style Vencord userplugin project, not an official Discord or Vencord feature. Contributions and bug reports are welcome. Please avoid posting real personal information, private call recordings, tokens, or other secrets in issues.
