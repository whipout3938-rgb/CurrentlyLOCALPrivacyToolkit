# PrivacyToolkit Mobile (Kettu beta)

This is the first mobile implementation of PrivacyToolkit. It is a **Vendetta-compatible external plugin** loaded by Kettu. It is not an APK injector and does not patch or repackage the Discord application binary.

## Current first-build features

- Locally scans outgoing messages for email addresses, phone numbers, IPv4/IPv6 addresses, US SSN-like patterns, likely street addresses, coordinate pairs, and custom protected terms.
- Shows a local toast warning listing the detected categories.
- Optional automatic redaction, disabled by default.
- Stores preferences in the plugin's local Kettu/Vendetta plugin storage.
- Includes timestamp exclusions so media time labels such as `1:23`, `0:45 / 2:30`, and `1:02:33` are not mistaken for IPv6 addresses or coordinate pairs.

## Current limitations

This is an MVP, not a full port of the desktop Vencord plugin.

- It only hooks the outgoing `sendMessage` action. Incoming message scanning/redaction is not implemented yet.
- ImageGuard, OAuth authorization warnings, group-DM controls, OPSEC guidance, and call recording are not implemented in this build.
- It depends on Kettu's Vendetta compatibility API and Discord's internal `sendMessage` module. Discord updates can change that module.
- A successful package build does not prove runtime compatibility on every Discord mobile version. Test on Android and iOS separately.
- Message detection is heuristic. Review warnings before sending, and do not rely on it as a guarantee against disclosure.

## Install in Kettu

Kettu's current plugin screen accepts a direct URL to a Vendetta-style plugin folder containing `manifest.json` and the JavaScript file named by `main`. This repository includes a prebuilt folder at:

`builds/privacytoolkit-mobile/`

1. Install and configure Kettu using its supported loader for your device.
2. Open Discord with Kettu enabled.
3. Go to **Settings → Kettu → Plugins**.
4. Choose **Install a plugin**.
5. Paste the URL to this folder (the URL must end with a slash):

   `https://raw.githubusercontent.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/main/mobile/kettu/builds/privacytoolkit-mobile/`

6. Confirm Kettu's unproxied-plugin warning after verifying that the URL belongs to this project.
7. Enable **PrivacyToolkit Mobile**.
8. Open its settings and leave **Automatically redact findings** off initially. Test the warnings first.

For testing a feature branch, replace `main` in the URL with the branch name. Do not use a branch URL as a permanent installation source.

## Build and test

Requires Node.js 20 or later. No third-party packages are needed.

From the repository root:

```powershell
cd mobile/kettu
npm test
npm run build
node --check builds/privacytoolkit-mobile/index.js
```

The build copies the parenthesized plugin expression into the distributable folder and calculates the SHA-256 manifest hash. Commit the generated `builds/privacytoolkit-mobile/manifest.json` and `index.js` whenever the source changes.

## Privacy and permissions

The mobile MVP scans message text locally before sending. It does not upload message content to a PrivacyToolkit server, request credentials, or collect Discord tokens. Kettu plugins execute inside the Discord client, so only install code from a source you trust.
