# PrivacyToolkit changelog

## 2.2.1
- Renamed the plugin from AntiDoxx to PrivacyToolkit to describe its best-effort privacy utilities without implying guaranteed prevention.
- Updated plugin, recorder, warning, CSS, storage-key, documentation, and package branding.
- Migrates the previously saved AntiDoxx group-DM baseline on first start after the rename.
- Existing Vencord plugin settings may need review because the visible plugin name changed.

## 2.2.0
- Added consent-gated local call recording with a persistent recording indicator and timer.
- Captures microphone and desktop/system audio as separate source tracks, then creates a mixed track.
- Saves three audio-only WebM files: combined, microphone-only, and desktop-audio-only.
- Defaults to the user's download destination and supports a custom folder where Chromium's directory picker is available.
- Does not create a second Discord account, use self-bot automation, or upload recordings.
- Recording requires a manual Arm Call click after the user confirms that all participants have agreed.
- Desktop-audio capture availability depends on Discord/Electron/Windows support and the system-audio option selected in the display picker.

## 2.1.1
- Fixed group auto-leave to use Discord's Group DM Remove Recipient route for the current account, rather than merely closing the private channel.
- Fixed group-owner detection to use Vencord's `ownerId` / `isOwner` channel fields so groups you create are preserved.

## 2.1.0
- Added automatic leave handling for newly added group DMs and recipient-add events targeting the current account.
- Added a trusted Group DM channel-ID allowlist.
- Added an optional GitHub Releases checker that runs on startup and every 24 hours.
- Clarified that update notifications do not self-install; Vencord must be rebuilt and restarted after source replacement.