# Meta Quest compatibility spike

**Status: research and test-plan stage. No Quest device has been tested by the PrivacyToolkit maintainers, and Quest support is not currently claimed.**

## What we are trying to support

The target is PrivacyToolkit running inside Discord while Discord is open on a Meta Quest headset. PrivacyToolkit is a client-side Discord plugin; a separate companion app cannot safely inspect another app's private message contents because of Android app sandboxing.

There are two different Discord apps/routes to distinguish:

### 1. Official Discord app from the Meta Horizon Store

Discord released an official Quest app on June 30, 2026. Discord documents support for Quest 2, Quest Pro, Quest 3, and Quest 3S, including servers, DMs, group DMs, voice/video calls, and gameplay streaming.

This is a Horizon OS-targeted app, not the ordinary Android phone APK. KettuManager's published installation flow does not patch an app already installed from the Horizon Store: its source downloads the regular Android Discord base/split APKs from its configured tracker, rewrites their package identity, and injects Kettu's Xposed module using LSPatch. Therefore, **do not assume the official Quest Store app can load Kettu or PrivacyToolkit**. We should not try to modify the user's store-installed app as the first experiment.

Official references:
- [Discord on Meta Quest FAQ](https://support.discord.com/hc/en-us/articles/41412722792983-Discord-on-Meta-Quest-FAQ)
- [Discord announcement](https://discord.com/blog/discord-is-now-on-meta-quest-reach-out-to-your-servers-while-in-vr)
- [Meta Horizon OS quick start](https://developers.meta.com/vr/essentials/quick-start/)

### 2. Standard Android Discord app running on Quest

Meta Horizon OS is based on AOSP and supports standard Android apps. Meta documents that Android apps can run as 2D panels in the Quest environment, and that developers can sideload their own APKs using Developer Mode and ADB.

Kettu's published Android route uses KettuManager (non-root) or KettuXposed (root/Xposed). The KettuManager source shows a flow that downloads Android Discord APK splits, rewrites the manifest package name, signs the modified APKs, embeds the Kettu/Xposed module with LSPatch, and installs the resulting package. This suggests a **possible** Quest route: use a Kettu-managed standard Android Discord build as a separate app in a Quest 2D window, then install PrivacyToolkit through Kettu's Vendetta-compatible external plugin loader.

This is an unverified compatibility hypothesis, not a working Quest installer. KettuManager and Kettu itself do not document Meta Quest as a supported platform.

References:
- [Meta: Horizon OS quick start and Android app support](https://developers.meta.com/vr/essentials/quick-start/)
- [Meta: enable Developer Mode and test on device](https://developers.meta.com/vr/documentation/android-apps/enable-developer-mode/)
- [Kettu Android installation options](https://github.com/C0C0B01/Kettu)
- [KettuManager source](https://github.com/C0C0B01/KettuManager)

## Recommended first implementation

Reuse the existing [Kettu mobile MVP](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/pull/2) rather than building a separate VR app. The first target is the normal Android Discord app running as a flat 2D app on Quest. We can consider spatial/immersive UI only if there is a real need after the plugin works.

The first Quest milestone should prove, in order:

1. A standard Android Discord app (not the Horizon Store-specific app) can be installed and launched on the headset as a 2D panel.
2. A KettuManager-managed build of that Android app can be installed separately without replacing or modifying the official Quest Store Discord app.
3. Kettu loads inside that Android Discord build and exposes its plugin settings.
4. PrivacyToolkit loads from its external plugin manifest and displays its settings.
5. The outgoing `sendMessage` hook attaches and detects synthetic test values in a private test channel.
6. Warnings, disabled-scanning behavior, custom terms, and opt-in redaction all behave correctly with Quest controllers/hand input.
7. Text entry, focus, scrolling, and settings controls remain usable while the app is in a Quest panel.

## Safe device setup prerequisites

Meta's current developer documentation requires a verified Meta developer account that belongs to a developer team, an eligible account (18+), Developer Mode enabled for the paired headset, and USB debugging approval for ADB-based testing. A USB-C data cable is required for the wired workflow. See [Meta's current device setup instructions](https://developers.meta.com/vr/documentation/native/android/mobile-device-setup/).

Do not:
- Disable or uninstall the official Quest Store Discord app to run the test.
- Install a modified APK from an unknown mirror or an unofficial re-upload.
- Provide Discord passwords, tokens, session cookies, or account credentials to maintainers.
- Test with real private messages or actual personal information.
- Treat a successful install or plugin settings screen as proof that message interception works.

Use a secondary/test Discord account and synthetic message contents for initial testing. Keep the test build separate from your daily Discord app. Kettu/LSPatch is third-party client modification software; review its source and release provenance before installing it, and understand that modified clients may be unsupported by Discord.

## Current technical scope

The existing mobile MVP currently targets Kettu's Vendetta-compatible plugin API. It scans outgoing message text locally, warns by toast, and has optional auto-redaction disabled by default. It does not currently provide incoming-message scanning, ImageGuard, OAuth authorization guard, group-DM tools, or call recording.

The plugin itself is not a VR rendering application. A working Kettu/Discord client integration would be expected to use Discord's normal Android 2D UI; the Quest system supplies controller/hand interaction with that panel. The plugin settings UI must still be tested on real hardware.

## Test report checklist

A Quest compatibility report should include:
- Headset model (Quest 2, Quest Pro, Quest 3, or Quest 3S).
- Horizon OS version/build (not serial number).
- Discord route: official Horizon Store app or standard Android Discord app.
- If using the Android route: KettuManager version/source and Kettu version.
- Whether Discord launches, Kettu loads, the PrivacyToolkit settings appear, and the send hook works.
- Exact synthetic test case, expected result, actual result, and sanitized errors.

Never attach headset serial numbers, account IDs, access tokens, private messages, voice recordings, or screenshots containing identifying information.
