# PrivacyToolkit Quest Experimental v0.1

**Status: experimental plugin bundle only. Quest 3 and Quest 3S are both unverified.**

This package is for controlled testing by people who already have Kettu running inside a separately installed standard Android Discord client on Meta Horizon OS. It is not a Quest-native app or a Discord installer.

## What is included

- `plugin/index.js`: PrivacyToolkit Mobile plugin code.
- `plugin/manifest.json`: Kettu/Vendetta-compatible external plugin manifest.

## What is not included

This ZIP does **not** include Discord, a Discord APK, KettuManager, Kettu, LSPatch, an APK patcher, or a sideload installer. It does not modify or replace the official Discord app from the Meta Horizon Store. The proposed KettuManager/LSPatch route on Horizon OS has not been validated.

## Device status

| Device | Status |
| --- | --- |
| Meta Quest 3 | Unverified; maintainer test target |
| Meta Quest 3S | Unverified; friend/tester target |

A successful desktop build or GitHub Actions run is not evidence that the package works on either headset. Report every stage separately.

## Prerequisites and safe setup

1. Use a secondary/test Discord account and a private test server/channel. Do not use a primary account for modified-client experiments.
2. Enable Meta Developer Mode and USB debugging only through Meta's official developer setup. A verified developer account/team and USB-C data connection may be required for wired ADB.
3. Keep the official Horizon Store Discord app installed and untouched.
4. The candidate route requires a standard Android Discord client with Kettu already loaded as a separate app. KettuManager/Kettu support for Quest is unverified. Obtain tools only from their official upstream project sources, review their provenance, and stop if the installation process asks you to replace the store app or use an unknown APK mirror.
5. Only after Kettu is running in that separate Android Discord client, install this plugin through Kettu's plugin screen.

## Install the plugin in Kettu

1. Open the Kettu-enabled standard Android Discord app.
2. Go to **Settings → Kettu → Plugins → Install a plugin**.
3. Paste this project plugin folder URL (the trailing slash matters):

   `https://raw.githubusercontent.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/main/mobile/kettu/builds/privacytoolkit-mobile/`

4. Confirm the unproxied-plugin warning only after checking that the URL belongs to this repository.
5. Enable **PrivacyToolkit Mobile**, then open its settings.
6. Keep **Automatically redact findings** OFF for the first test.

If the plugin folder cannot be loaded, record the sanitized error and stop. Do not send credentials, tokens, cookies, or private messages to maintainers.

## Synthetic test sequence

Use only a secondary/test account and synthetic values.

1. With scanning enabled, send: `Quest test: privacy-test@example.invalid`
2. Expected: a local warning identifies an email address. With automatic redaction OFF, the outgoing message remains unchanged.
3. Turn automatic redaction ON in PrivacyToolkit settings.
4. Send the same synthetic test string again.
5. Expected: the detected email is replaced with `[REDACTED]` before sending.
6. Turn automatic redaction back OFF after the test.
7. Test a custom protected term such as `QUEST-TEST-ALPHA`.
8. Test settings focus, scrolling, text entry, toggles, and send flow with both controllers and hand input if available.

The `.invalid` domain is reserved for testing. Never substitute a real person's email, phone, address, location, SSN, or private message.

## Current limitations

- Outgoing message scanning only. No incoming scanning.
- No ImageGuard, OAuth authorization guard, group-DM controls, OPSEC Center, or call recording.
- Heuristic detection may miss content or produce false positives.
- Depends on Kettu's Vendetta compatibility API and Discord's internal `sendMessage` module, which can change.
- Quest 2D panel focus, keyboard, controller, and hand input behavior has not been tested by maintainers.
- Modified clients are third-party software and may be unsupported by Discord.

## Report results

Use the repository's [Meta Quest compatibility issue form](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/issues/new?template=meta_quest_compatibility.yml). Include headset model and Horizon OS version/build, but never serial numbers or account IDs. Provide exact synthetic test cases and sanitized error text.

**Never submit passwords, Discord tokens, session cookies, private messages, personal information, headset serial numbers, identifying screenshots, or recordings.**
