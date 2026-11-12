# PrivacyToolkit public beta testing

Thanks for helping test PrivacyToolkit. This is experimental software: detection can miss sensitive information, produce false positives, or stop working after Discord/Vencord changes. It is not a security boundary and must not be treated as a guarantee that personal information will stay private.

## What is open for testing

| Platform/build | Status | How to participate |
|---|---|---|
| Desktop Vencord | **Open beta** | Test the [v2.5.0 pre-release](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/releases/tag/v2.5.0) using the install steps below. |
| Android / Kettu | **Early MVP; device validation pending** | The mobile implementation is in [PR #2](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/pull/2). It is not yet a supported public beta. |
| iPhone / Kettu | **Not yet available for general testing** | A maintained, non-jailbreak iOS loader has not been confirmed. Do not jailbreak or install abandoned loaders just to participate. |
| Meta Quest | **Not supported / not investigated** | No Quest build is available. |
| Call recorder | **Experimental; compatibility varies** | Test only with everyone’s informed agreement. See the consent and limitations notes below. |

The public beta currently means the **desktop Vencord build**. Mobile and Quest work must not be described as generally supported until their own loader and device testing is complete.

## Join the desktop beta

1. Read the [project README](../README.md), especially its limitations and install instructions.
2. Download the `privacytoolkit.zip` asset from the [v2.5.0 pre-release](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/releases/tag/v2.5.0).
3. Back up your Vencord checkout and any existing PrivacyToolkit folder.
4. Follow the README's install steps. Keep only one copy of the plugin in `src/userplugins/`.
5. Build and inject Vencord, restart Discord, and enable PrivacyToolkit in Vencord's plugin settings.
6. Record the plugin version, Vencord build/commit if available, Discord channel, operating system, and the result of each test.

Do not download plugin builds from unofficial mirrors or run scripts sent to you in issue comments or DMs.

## Safe test checklist

Use a private test server or a test account where practical. Use synthetic examples only; do not deliberately publish real personal information to see whether the plugin catches it.

- [ ] **Basic message flow:** Send ordinary text such as `Hello from the PrivacyToolkit beta`. It should remain unchanged.
- [ ] **Email detection:** Use a reserved example address such as `tester@example.invalid`. Confirm that the warning appears and that the message is unchanged when automatic redaction is off.
- [ ] **Custom protected terms:** Add a made-up phrase such as `BlueCometTestAlias`, send it in a test message, then remove it from the list.
- [ ] **IPv4 detection:** Use the documentation-only address `192.0.2.10`.
- [ ] **IPv6 detection:** Use the documentation-only address `2001:db8::1`. **Known issue in v2.5.0:** IPv6 detection may mistake media timestamps for IPv6-shaped text. Until the [timestamp fix in PR #1](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/pull/1) is merged and released, turn off Detect IPv6 for routine use or test the false positive separately.
- [ ] **Automatic redaction:** Only in a test channel, enable automatic redaction and confirm a synthetic value is replaced. Turn it off afterward if you do not want that behavior.
- [ ] **ImageGuard:** Use a test image you created with deliberately non-sensitive sample metadata or a fake QR payload. Do not use a personal photo, location-tagged image, ID, or screenshot containing private chats.
- [ ] **App Authorization Guard:** Use only the fake-client-ID test links in the README. Never substitute a real application ID or authorize an unfamiliar app as part of testing.
- [ ] **Group-DM protection:** Do not test in real community group DMs. Use a controlled test account/server and remember that auto-leave cannot prevent the initial server-side addition.
- [ ] **Call recorder:** Only test when every participant has been told recording is occurring and has explicitly agreed. Use a short test call with no private discussion. Check the selected microphone/system-audio sources and confirm the output stays local.

Not every test applies to every platform or build. Mark unsupported or unavailable features as such rather than treating them as passing.

## What to include in feedback

Open a [Bug / false-positive report](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/issues/new?template=bug_report.yml) or [Feature request](https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/issues/new?template=feature_request.yml).

Useful details include:
- PrivacyToolkit version and whether it came from a GitHub release or a local build.
- Operating system/version, Discord channel (Stable/PTB/Canary), and Vencord version or commit.
- Which feature/settings were enabled.
- Exact steps to reproduce, what you expected, and what happened instead.
- Sanitized error text from the console, if relevant.

For false positives or missed detections, describe the pattern with a synthetic example. Do not paste the original message.

## Privacy and security rules for reports

**Never attach or paste:**
- Discord tokens, passwords, authentication codes, API keys, or session cookies.
- Real email addresses, phone numbers, street addresses, government identifiers, IP addresses, or private account IDs.
- Private messages, DM exports, unredacted screenshots, personal photos, or location metadata.
- Call recordings or other people’s voice data.

Remove usernames, server names, channel IDs, message IDs, and other identifying details from logs. If a report accidentally includes a secret, delete the attachment/comment and rotate the exposed credential immediately.

PrivacyToolkit scans locally in the client; reports should not require sending message content to the maintainers. Do not give maintainers remote access to your Discord account or device.

## Known beta limitations

- Detection is heuristic. It can miss content and can flag harmless text.
- Incoming DOM redaction and outgoing message hooks depend on Discord/Vencord internals and may be affected by client updates.
- ImageGuard checks rely on APIs exposed by the current Discord/Electron environment; unavailable OCR/QR checks are not a clean result.
- The OAuth guard only covers recognizable authorization flows inside the client; it cannot inspect an app developer's private data handling.
- Group-DM auto-leave runs after the account is added and cannot prevent the initial server-side addition.
- Call recording depends on capture APIs and operating-system audio routing. A missing audio track means the call was not fully captured.
- Mobile Kettu and Meta Quest are not part of the supported public beta yet.

## What happens to reports

The maintainer will triage reports, try to reproduce them, and may ask for sanitized details. A report is not a promise that a feature will be added or a fix will be released. Please search existing issues before opening a duplicate.

Thanks for helping improve PrivacyToolkit!
