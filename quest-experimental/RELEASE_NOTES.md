# PrivacyToolkit Quest Experimental v0.1

This is an experimental Kettu/Vendetta-compatible plugin bundle for exploratory testing on Meta Quest 3 and Meta Quest 3S.

## Important status

- **Quest 3: unverified**
- **Quest 3S: unverified**
- This release is not a Quest-native application and is not a modified Discord APK.
- It does not install Discord, Kettu, KettuManager, or LSPatch.
- The official Meta Horizon Store Discord app is not modified or supported by this package.
- KettuManager/LSPatch on Horizon OS remains an unverified installation hypothesis.

## Included functionality

- Local outgoing-message scanning for email, phone, IPv4/IPv6, SSN-like patterns, likely street addresses, coordinates, and custom protected terms.
- Local warning toast.
- Optional automatic redaction, disabled by default.

## Validation

The GitHub Actions workflow runs the Kettu mobile smoke tests, rebuilds the plugin bundle, validates JavaScript syntax, and packages the files. CI success does not prove headset compatibility. Actual Quest 3 and Quest 3S device testing is still required.

## Safe testing

Use a secondary/test Discord account, synthetic message contents, and a separately installed standard Android Discord build only if you can verify its source. Keep the official Horizon Store app untouched. Never send credentials, tokens, session cookies, private messages, personal information, headset serial numbers, identifying screenshots, or recordings in reports.

See `docs/META_QUEST_COMPATIBILITY.md` and the README included in the ZIP for prerequisites, installation instructions, limitations, and test steps.
