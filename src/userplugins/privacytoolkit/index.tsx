/*
 * PrivacyToolkit — private Vencord userplugin
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * Privacy note: scanning is performed locally in the Discord client.
 */

import "./styles.css";

import * as DataStore from "@api/DataStore";
import { showNotice as showNoticeInternal } from "@api/Notices";
import { definePluginSettings } from "@api/Settings";
import definePlugin from "@utils/types";
import { OptionType } from "@utils/types";
import type { CloudUpload, Message } from "@vencord/discord-types";
import { ChannelStore, RestAPI, UserStore } from "@webpack/common";

import { ImageGuardIcon, makeImageGuardChatBarButton, scanPendingImageUploads } from "./imageGuard";
import { startAuthorizationGuard, stopAuthorizationGuard } from "./authorizationGuard";

const PLUGIN_VERSION = "2.5.1";
const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const REDACTED = "[REDACTED]";
const WARNING_CLASS = "privacy-toolkit-warning";

function showNotice(message: string) {
    showNoticeInternal(message, "OK", () => {});
}

const settings = definePluginSettings({
    protectIncoming: {
        type: OptionType.BOOLEAN,
        description: "Scan incoming messages and redact detected personal information in the visible chat.",
        default: true
    },
    protectOutgoing: {
        type: OptionType.BOOLEAN,
        description: "Redact detected personal information in outgoing messages before they are sent.",
        default: true
    },
    detectEmail: {
        type: OptionType.BOOLEAN,
        description: "Detect email addresses.",
        default: true
    },
    detectPhone: {
        type: OptionType.BOOLEAN,
        description: "Detect phone numbers.",
        default: true
    },
    detectIp: {
        type: OptionType.BOOLEAN,
        description: "Detect public and private IPv4 addresses in messages.",
        default: true
    },
    detectIpv6: {
        type: OptionType.BOOLEAN,
        description: "Detect IPv6 address-like strings. This is heuristic and may flag some non-IP text.",
        default: true
    },
    protectedIps: {
        type: OptionType.STRING,
        description: "Your own IP addresses to protect explicitly. Separate exact IPv4 or IPv6 values with commas or new lines. This does not look up anyone's IP.",
        default: ""
    },
    detectIpLoggerLinks: {
        type: OptionType.BOOLEAN,
        description: "Redact links matching a small local list of known IP-logging services. This cannot identify every tracker or redirect.",
        default: true
    },
    detectDoxxingClusters: {
        type: OptionType.BOOLEAN,
        description: "Raise a stronger warning when one message combines multiple personal-data types, or pairs personal data with a known IP-logging link.",
        default: true
    },
    detectAddress: {
        type: OptionType.BOOLEAN,
        description: "Detect likely street addresses (heuristic; may have false positives).",
        default: true
    },
    detectCoordinates: {
        type: OptionType.BOOLEAN,
        description: "Detect latitude/longitude coordinate pairs.",
        default: true
    },
    detectSsn: {
        type: OptionType.BOOLEAN,
        description: "Detect US Social Security number patterns.",
        default: true
    },
    detectUsername: {
        type: OptionType.BOOLEAN,
        description: "Detect custom protected identity terms and social handles you add below.",
        default: true
    },
    exposureGuardEnabled: {
        type: OptionType.BOOLEAN,
        description: "Enable Exposure Guard: warn about public profile links and combinations that could connect separate online identities. No external OSINT searches are performed.",
        default: true
    },
    detectSocialProfileLinks: {
        type: OptionType.BOOLEAN,
        description: "Warn when a message contains a link to a recognizable public social profile. Links are flagged for review, not automatically removed.",
        default: true
    },
    protectOwnDiscordId: {
        type: OptionType.BOOLEAN,
        description: "Automatically detect your current Discord account ID in messages so you can avoid sharing it accidentally.",
        default: true
    },
    blockHighRiskMessages: {
        type: OptionType.BOOLEAN,
        description: "Hold a message or edit when Exposure Guard finds a high-risk combination. Disabled by default to avoid blocking legitimate messages.",
        default: false
    },
    appAuthorizationGuardEnabled: {
        type: OptionType.BOOLEAN,
        description: "Show a confirmation warning before standard Discord OAuth2 bot and application authorization links are opened.",
        default: true
    },
    warnOnEmailScope: {
        type: OptionType.BOOLEAN,
        description: "Warn when an authorization request asks for your Discord email address.",
        default: true
    },
    warnOnSensitiveScopes: {
        type: OptionType.BOOLEAN,
        description: "Warn about connected accounts, server membership, role-connection, message, and webhook OAuth scopes.",
        default: true
    },
    warnOnPrivilegedBotPermissions: {
        type: OptionType.BOOLEAN,
        description: "Warn when a bot requests powerful server permissions such as Administrator, Manage Server, Manage Roles, or Manage Webhooks.",
        default: true
    },
    warnOnBotMessageAccess: {
        type: OptionType.BOOLEAN,
        description: "Warn when a bot requests both View Channel and Read Message History.",
        default: true
    },
    imageGuardEnabled: {
        type: OptionType.BOOLEAN,
        description: "Enable local ImageGuard image inspection.",
        default: true
    },
    imageGuardAutoScan: {
        type: OptionType.BOOLEAN,
        description: "Automatically inspect pending image files before upload.",
        default: true
    },
    imageGuardManualScan: {
        type: OptionType.BOOLEAN,
        description: "Show a manual scan button beside the composer when image attachments are pending.",
        default: true
    },
    imageGuardBlockOnFindings: {
        type: OptionType.BOOLEAN,
        description: "Remove flagged images from the pending draft. Disabled by default; otherwise findings are warnings only.",
        default: false
    },
    detectImageMetadata: {
        type: OptionType.BOOLEAN,
        description: "Inspect local image files for EXIF and GPS metadata before upload.",
        default: true
    },
    detectTrackingLinks: {
        type: OptionType.BOOLEAN,
        description: "Warn about common tracking parameters in links you are about to send.",
        default: true
    },
    opsecCompartmentalization: {
        type: OptionType.BOOLEAN,
        description: "Show identity compartmentalization guidance in OPSEC Center.",
        default: true
    },
    opsecMetadata: {
        type: OptionType.BOOLEAN,
        description: "Show metadata protection guidance in OPSEC Center.",
        default: true
    },
    opsecLinks: {
        type: OptionType.BOOLEAN,
        description: "Show link privacy guidance in OPSEC Center.",
        default: true
    },
    opsecFootprint: {
        type: OptionType.BOOLEAN,
        description: "Show digital-footprint guidance in OPSEC Center.",
        default: true
    },
    opsecAccount: {
        type: OptionType.BOOLEAN,
        description: "Show account-security audit guidance in OPSEC Center.",
        default: true
    },
    opsecResponse: {
        type: OptionType.BOOLEAN,
        description: "Show exposure-response guidance in OPSEC Center.",
        default: true
    },
    protectedTerms: {
        type: OptionType.STRING,
        description: "Local identity watchlist: usernames/handles reused elsewhere, aliases, names, schools, employers, neighborhoods, and other identifiers you want flagged. Separate entries with commas or new lines.",
        default: "",
        multiline: true
    },
    redactIncomingDom: {
        type: OptionType.BOOLEAN,
        description: "Replace matching text in the visible message DOM. This is best-effort and may be affected by Discord UI updates.",
        default: true
    },
    scanImageAltText: {
        type: OptionType.BOOLEAN,
        description: "Scan image alt text, filenames, and accessible labels (not the pixels inside an image).",
        default: true
    },
    experimentalImageOcr: {
        type: OptionType.BOOLEAN,
        description: "Attempt on-device image OCR only if the browser exposes the experimental TextDetector API. Availability varies by browser.",
        default: false
    },
    autoLeaveNewGroupDms: {
        type: OptionType.BOOLEAN,
        description: "Automatically leave newly added group DMs and group DMs that add your account. Existing groups are remembered on first enable. Groups you create yourself are kept.",
        default: true
    },
    trustedGroupDmIds: {
        type: OptionType.STRING,
        description: "Group DM channel IDs that PrivacyToolkit should never auto-leave. Separate IDs with commas or new lines.",
        default: ""
    },
    checkForUpdates: {
        type: OptionType.BOOLEAN,
        description: "Check the configured public GitHub release repository on startup and every 24 hours. This only checks and notifies; updating still requires rebuilding Vencord.",
        default: true,
        onChange(enabled: boolean) {
            if (enabled) void checkForUpdates();
        }
    },
    updateRepository: {
        type: OptionType.STRING,
        description: "GitHub repository for PrivacyToolkit releases, in owner/repository format.",
        default: "whipout3938-rgb/CurrentlyLOCALPrivacyToolkit",
        onChange() {
            void checkForUpdates();
        }
    }
});

type GroupDmChannel = {
    id: string;
    type: number;
    ownerId?: string;
    isOwner?: (userId: string) => boolean;
    isGroupDM?: () => boolean;
};

type RecipientAddEvent = { channelId: string; user?: { id?: string } };

const knownGroupDmIds = new Set<string>();
const pendingGroupDmLeaves = new Set<string>();
let groupDmUserId: string | null = null;
let groupDmInitialization: Promise<void> | null = null;
let groupDmInitialized = false;
let updateTimer: ReturnType<typeof setInterval> | undefined;
let updateCheckInFlight = false;
let lastNotifiedRelease = "";

function isGroupDm(channel: GroupDmChannel | null | undefined): channel is GroupDmChannel {
    return channel?.type === 3 || channel?.isGroupDM?.() === true;
}

function trustedGroupIds(): Set<string> {
    return new Set(settings.store.trustedGroupDmIds
        .split(/[\s,;]+/)
        .map(id => id.trim())
        .filter(id => /^\d{17,20}$/.test(id)));
}

function groupDmStorageKey(userId: string) {
    return `PrivacyToolkit:knownGroupDms:${userId}`;
}

async function saveKnownGroupDms() {
    if (!groupDmUserId) return;
    await DataStore.set(groupDmStorageKey(groupDmUserId), [...knownGroupDmIds].slice(-3000));
}

async function leaveGroupDm(channel: GroupDmChannel, force = false) {
    const currentUserId = UserStore.getCurrentUser()?.id;
    if (!settings.store.autoLeaveNewGroupDms || !currentUserId) return;
    if ((!force && (channel.ownerId === currentUserId || channel.isOwner?.(currentUserId))) || trustedGroupIds().has(channel.id)) return;
    if (pendingGroupDmLeaves.has(channel.id)) return;

    pendingGroupDmLeaves.add(channel.id);
    try {
        // Remove the current account from the group DM explicitly. Closing
        // /channels/{id} only closes/hides a private channel; it is not the
        // Group DM Remove Recipient operation.
        await RestAPI.del({ url: `/channels/${channel.id}/recipients/${currentUserId}` });
        showNotice("PrivacyToolkit automatically left a new group DM. Add its channel ID to Trusted Group DM IDs to keep it.");
    } catch {
        showNotice("PrivacyToolkit could not automatically leave a new group DM. Leave it manually and check that Vencord is connected.");
    } finally {
        pendingGroupDmLeaves.delete(channel.id);
    }
}

async function initializeGroupDmProtection() {
    const currentUserId = UserStore.getCurrentUser()?.id;
    if (!currentUserId || (groupDmInitialized && groupDmUserId === currentUserId)) return;
    if (groupDmInitialization) return groupDmInitialization;

    groupDmInitialization = (async () => {
        const currentStored = await DataStore.get<string[]>(groupDmStorageKey(currentUserId));
        // Rebrand migration: preserve the previous AntiDoxx group-DM baseline.
        const legacyStored = Array.isArray(currentStored)
            ? undefined
            : await DataStore.get<string[]>(`AntiDoxx:knownGroupDms:${currentUserId}`);
        const stored = Array.isArray(currentStored) ? currentStored : legacyStored;
        knownGroupDmIds.clear();
        if (Array.isArray(stored)) {
            for (const id of stored) if (typeof id === "string") knownGroupDmIds.add(id);
            groupDmUserId = currentUserId;
            // Groups that appeared while Discord was closed are treated as new.
            const appearedWhileOffline = (ChannelStore.getSortedPrivateChannels() as GroupDmChannel[])
                .filter(channel => isGroupDm(channel) && !knownGroupDmIds.has(channel.id));
            for (const channel of appearedWhileOffline) knownGroupDmIds.add(channel.id);
            if (appearedWhileOffline.length) await saveKnownGroupDms();
            groupDmInitialized = true;
            for (const channel of appearedWhileOffline) await leaveGroupDm(channel);
            return;
        }

        // First enable: preserve group DMs already present, then watch for new ones.
        const existing = (ChannelStore.getSortedPrivateChannels() as GroupDmChannel[]).filter(isGroupDm);
        for (const channel of existing) knownGroupDmIds.add(channel.id);
        groupDmUserId = currentUserId;
        await saveKnownGroupDms();
        groupDmInitialized = true;
    })().catch(() => {
        showNotice("PrivacyToolkit could not initialize group DM protection. Group-chat auto-leave may not work until Discord reconnects.");
    }).finally(() => {
        groupDmInitialization = null;
    });

    return groupDmInitialization;
}

async function handleGroupDmCreate(channel: GroupDmChannel) {
    if (!isGroupDm(channel)) return;
    await initializeGroupDmProtection();
    if (knownGroupDmIds.has(channel.id)) return;
    knownGroupDmIds.add(channel.id);
    await saveKnownGroupDms();
    if (settings.store.autoLeaveNewGroupDms) await leaveGroupDm(channel);
}

async function handleCurrentUserAddedToGroupDm({ channelId, user }: RecipientAddEvent) {
    const currentUserId = UserStore.getCurrentUser()?.id;
    if (!settings.store.autoLeaveNewGroupDms || !currentUserId || user?.id !== currentUserId) return;
    await initializeGroupDmProtection();
    const channel = ChannelStore.getChannel(channelId) as GroupDmChannel | undefined;
    if (!isGroupDm(channel) || trustedGroupIds().has(channelId)) return;
    await leaveGroupDm(channel, true);
}

function isNewerVersion(latest: string, current: string): boolean {
    const numbers = (value: string) => (value.match(/\d+/g) ?? []).slice(0, 3).map(Number);
    const a = numbers(latest);
    const b = numbers(current);
    for (let i = 0; i < 3; i++) {
        const av = a[i] ?? 0;
        const bv = b[i] ?? 0;
        if (av !== bv) return av > bv;
    }
    return false;
}

async function checkForUpdates() {
    if (!settings.store.checkForUpdates || updateCheckInFlight) return;
    const match = settings.store.updateRepository.trim().match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
    if (!match) return;

    updateCheckInFlight = true;
    try {
        const [, owner, repository] = match;
        const response = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/releases/latest`, {
            headers: { Accept: "application/vnd.github+json" },
            cache: "no-store"
        });
        if (!response.ok) return;
        const release = await response.json() as { tag_name?: string; html_url?: string; draft?: boolean; prerelease?: boolean };
        const latest = (release.tag_name || "").replace(/^v/i, "");
        if (!latest || release.draft || release.prerelease || !isNewerVersion(latest, PLUGIN_VERSION) || lastNotifiedRelease === latest) return;
        lastNotifiedRelease = latest;
        showNotice(`PrivacyToolkit ${latest} is available (installed: ${PLUGIN_VERSION}). Release: ${release.html_url || `https://github.com/${owner}/${repository}/releases`}. Download the source, replace the plugin files, rebuild Vencord, and restart Discord.`);
    } catch {
        // Update checks are best-effort and never interrupt Discord.
    } finally {
        updateCheckInFlight = false;
    }
}

type Finding = { label: string; pattern: RegExp; redact?: boolean };

function customTerms(): string[] {
    return settings.store.protectedTerms
        .split(/[,\n\r]+/)
        .map(term => term.trim())
        .filter(term => term.length >= 2)
        .slice(0, 200);
}

function protectedIpTerms(): string[] {
    return settings.store.protectedIps
        .split(/[,\n\r]+/)
        .map(ip => ip.trim())
        .filter(ip => ip.length >= 3)
        .slice(0, 50);
}

function getFindings(): Finding[] {
    const s = settings.store;
    const findings: Finding[] = [];

    if (s.detectEmail)
        findings.push({ label: "email address", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi });

    if (s.detectPhone)
        findings.push({ label: "phone number", pattern: /(?<!\w)(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}(?!\w)/g });

    if (s.detectIp)
        findings.push({ label: "IPv4 address", pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g });

    if (s.detectIpv6)
        findings.push({ label: "IPv6-like address", pattern: /(?<![\da-f:])(?:(?:[a-f0-9]{1,4}:){1,7}:?[a-f0-9]{0,4}|::[a-f0-9]{1,4})(?![\da-f:])/gi });

    if (s.detectIpLoggerLinks)
        findings.push({
            label: "known IP-logging link",
            pattern: /\b(?:https?:\/\/)?(?:www\.)?(?:grabify\.link|iplogger\.(?:org|com|ru)|2no\.co|yip\.su|ps3cfw\.com|blasze\.com)(?![\w.-])(?:[/:?#][^\s<>\x22']*)?/gi
        });

    for (const ip of protectedIpTerms()) {
        const escaped = ip.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        findings.push({ label: "your protected IP address", pattern: new RegExp(escaped, "gi") });
    }

    if (s.detectTrackingLinks && s.opsecLinks) {
        findings.push({
            label: "link tracking parameters",
            pattern: /https?:\/\/[^\s<>]+[?&](?:utm_[a-z0-9_]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|si|ref_src|vero_id)=[^\s&#<>]+/gi,
            redact: false
        });
    }

    if (s.detectSsn)
        findings.push({ label: "SSN-like number", pattern: /\b(?!000|666|9\d\d)\d{3}[- ]?(?!00)\d{2}[- ]?(?!0000)\d{4}\b/g });

    if (s.detectAddress)
        findings.push({
            label: "possible street address",
            pattern: /\b\d{1,6}\s+(?:[A-Z0-9.'-]+\s+){1,5}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir)\b\.?/gi
        });

    if (s.detectCoordinates)
        findings.push({
            label: "coordinate pair",
            pattern: /\b[-+]?(?:[0-8]?\d(?:\.\d+)?|90(?:\.0+)?)\s*[,/]\s*[-+]?(?:1[0-7]\d(?:\.\d+)?|[1-9]?\d(?:\.\d+)?|180(?:\.0+)?)\b/g
        });

    if (s.detectUsername) {
        for (const term of customTerms()) {
            const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            findings.push({ label: "custom protected identity", pattern: new RegExp(escaped, "gi") });
        }
    }

    if (s.exposureGuardEnabled && s.protectOwnDiscordId) {
        const ownId = UserStore.getCurrentUser()?.id;
        if (ownId && /^\d{17,20}$/.test(ownId)) {
            findings.push({
                label: "your Discord account ID",
                pattern: new RegExp("(?<!\\d)" + ownId + "(?!\\d)", "g")
            });
        }
    }

    if (s.exposureGuardEnabled && s.detectSocialProfileLinks) {
        findings.push({
            label: "public social profile link",
            pattern: /\b(?:https?:\/\/)?(?:www\.)?(?:instagram\.com\/[a-z0-9._]{2,}|tiktok\.com\/@?[a-z0-9._]{2,}|(?:x|twitter)\.com\/@?[a-z0-9_]{2,}|reddit\.com\/(?:user|u)\/[a-z0-9_-]{2,}|github\.com\/[a-z0-9-]{2,}|twitch\.tv\/[a-z0-9_]{2,}|youtube\.com\/@[\w.-]{2,}|steamcommunity\.com\/(?:id|profiles)\/[a-z0-9-]{2,}|threads\.net\/@[\w.-]{2,}|facebook\.com\/[a-z0-9.]{2,}|linkedin\.com\/in\/[a-z0-9-]{2,})(?:[/?#][^\s<>()]*)?/gi,
            redact: false
        });
    }

    return findings;
}

function isValidIpv6Address(candidate: string): boolean {
    // The IPv6-shaped detector also matches media timestamps such as 1:23 and
    // 1:02:33. Let the platform URL parser validate the candidate as a real
    // IPv6 literal before treating it as personal data.
    try {
        const parsed = new URL(`http://[${candidate}]/`);
        return parsed.hostname.startsWith("[") && parsed.hostname.endsWith("]");
    } catch {
        return false;
    }
}

function scanText(input: string): { text: string; labels: string[]; changed: boolean } {
    let output = input;
    const labels = new Set<string>();
    const personalDataSignals = new Set<string>();

    for (const finding of getFindings()) {
        // Detect against the original message so an earlier redaction cannot hide
        // a second overlapping clue (for example, a protected handle in a profile URL).
        finding.pattern.lastIndex = 0;
        const matches = Array.from(input.matchAll(finding.pattern));
        // IPv6-shaped text is only a candidate: validate it as a real IPv6
        // literal so video timestamps (for example, 1:23 / 2:30) stay visible.
        const actionableMatches = finding.label === "IPv6-like address"
            ? matches.filter(match => isValidIpv6Address(match[0]))
            : matches;

        if (actionableMatches.length) {
            labels.add(finding.label);
            if (finding.label !== "known IP-logging link") personalDataSignals.add(finding.label);
            if (finding.redact !== false) {
                if (finding.label === "IPv6-like address") {
                    output = output.replace(finding.pattern, match =>
                        isValidIpv6Address(match) ? REDACTED : match
                    );
                } else {
                    output = output.replace(finding.pattern, REDACTED);
                }
            }
        }
    }

    // A cluster is a heuristic alert, not proof of malicious intent. It is
    // calculated before redaction so related signals in the same message count.
    if (settings.store.detectDoxxingClusters && (
        personalDataSignals.size >= 2 ||
        (labels.has("known IP-logging link") && personalDataSignals.size >= 1)
    )) {
        labels.add("possible doxxing pattern");
    }

    return { text: output, labels: [...labels], changed: output !== input };
}

function scanForAccessory(message: Message): string[] {
    const parts = [message.content || ""];

    if (settings.store.scanImageAltText) {
        for (const embed of message.embeds ?? []) {
            parts.push([
                embed.rawTitle,
                embed.rawDescription,
                embed.url,
                embed.image?.url,
                embed.thumbnail?.url
            ].filter(Boolean).join(" "));
        }
        for (const attachment of message.attachments ?? []) {
            parts.push([attachment.filename, attachment.url]
                .filter(Boolean).join(" "));
        }
    }

    return scanText(parts.join("\n")).labels;
}

// DOM redaction is deliberately scoped to Discord message rows and only mutates
// text nodes. Original node text is retained in memory so stopping the plugin
// can restore nodes that are still mounted.
const originalText = new Map<Text, string>();
let observer: MutationObserver | undefined;
let ocrUnavailableNoticeShown = false;
const ocrChecked = new WeakSet<HTMLImageElement>();

function redactTextNode(node: Text) {
    const current = node.data;
    if (!current || current.includes(REDACTED)) return;
    const result = scanText(current);
    if (!result.changed) return;
    if (!originalText.has(node)) originalText.set(node, current);
    node.data = result.text;
}

function redactMessageElement(root: Element) {
    if (!settings.store.protectIncoming || !settings.store.redactIncomingDom) return;
    if (root.closest(`.${WARNING_CLASS}`)) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            const parent = node.parentElement;
            if (!parent || parent.closest("button, textarea, input, [contenteditable='true'], script, style, .privacy-toolkit-warning"))
                return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
        }
    });

    let node: Node | null;
    while ((node = walker.nextNode())) redactTextNode(node as Text);
}

function maybeRunExperimentalOcr(image: HTMLImageElement) {
    if (!settings.store.experimentalImageOcr || !settings.store.protectIncoming || ocrChecked.has(image)) return;
    ocrChecked.add(image);

    const TextDetectorCtor = (window as any).TextDetector;
    if (!TextDetectorCtor) {
        if (!ocrUnavailableNoticeShown) {
            ocrUnavailableNoticeShown = true;
            showNotice("PrivacyToolkit: this browser does not expose the experimental local TextDetector OCR API. Image pixel OCR is unavailable; image alt text and filenames can still be scanned.");
        }
        return;
    }

    // TextDetector is experimental and is not implemented in many Chromium builds.
    // No image is uploaded: createImageBitmap and detect() run in this client.
    void (async () => {
        try {
            const detector = new TextDetectorCtor();
            const bitmap = await createImageBitmap(image);
            try {
                const blocks = await detector.detect(bitmap);
                const text = blocks.map((block: { rawValue?: string }) => block.rawValue || "").join("\n");
                const result = scanText(text);
                if (result.changed) {
                    const row = image.closest("[data-message-id]");
                    if (row) {
                        row.setAttribute("data-privacytoolkit-image-hit", "true");
                        showNotice("PrivacyToolkit detected potentially sensitive text inside an image. Review the image before continuing.");
                    }
                }
            } finally {
                bitmap.close();
            }
        } catch {
            // OCR failures are intentionally silent; never block Discord rendering.
        }
    })();
}

function processVisibleMessages() {
    if (!settings.store.protectIncoming || !settings.store.redactIncomingDom) return;
    document.querySelectorAll<HTMLElement>("[data-message-id]").forEach(row => {
        redactMessageElement(row);
        if (settings.store.experimentalImageOcr) {
            row.querySelectorAll<HTMLImageElement>("img").forEach(maybeRunExperimentalOcr);
        }
    });
}

function startDomProtection() {
    processVisibleMessages();
    observer = new MutationObserver(records => {
        for (const record of records) {
            if (record.type === "characterData") {
                redactTextNode(record.target as Text);
                continue;
            }

            for (const added of record.addedNodes) {
                if (added.nodeType === Node.TEXT_NODE) {
                    redactTextNode(added as Text);
                } else if (added instanceof Element) {
                    if (added.matches("[data-message-id]")) redactMessageElement(added);
                    added.querySelectorAll?.("[data-message-id]").forEach(redactMessageElement);
                    if (settings.store.experimentalImageOcr) {
                        added.querySelectorAll?.("img").forEach(node => maybeRunExperimentalOcr(node as HTMLImageElement));
                    }
                }
            }
        }
    });

    observer.observe(document.body, { childList: true, characterData: true, subtree: true });
}

function stopDomProtection() {
    observer?.disconnect();
    observer = undefined;

    for (const [node, original] of originalText) {
        if (node.isConnected) node.data = original;
    }
    originalText.clear();
}

function getOutgoingReplacement(content: string): { content: string; labels: string[] } {
    const result = scanText(content);
    return { content: result.text, labels: result.labels };
}

function inspectOutgoingMessage(messageObj: { content: string; }): { cancel: boolean } | void {
    if (!settings.store.protectOutgoing && !settings.store.exposureGuardEnabled) return;

    const result = scanText(messageObj.content || "");
    const highRisk = result.labels.includes("possible doxxing pattern");

    // A configured high-risk hold preserves the draft in the composer for review.
    if (settings.store.exposureGuardEnabled && settings.store.blockHighRiskMessages && highRisk) {
        showNotice("Exposure Guard held this message or edit. Review the identity clues and remove anything you do not intend to share.");
        return { cancel: true };
    }

    if (settings.store.protectOutgoing && result.changed) {
        messageObj.content = result.text;
        const labels = result.labels.filter(label => label !== "possible doxxing pattern");
        showNotice(`PrivacyToolkit redacted detected information before sending: ${labels.join(" · ") || "sensitive details"}.`);
    } else if (settings.store.exposureGuardEnabled && result.labels.length) {
        showNotice(`Exposure Guard warning: ${result.labels.join(" · ")}. This message is still being sent; review it before sharing.`);
    }
}

function PrivacyToolkitAccessory({ message }: { message: Message }) {
    const labels = scanForAccessory(message);
    if (!labels.length) return null;
    const possibleDoxxing = labels.includes("possible doxxing pattern");

    return (
        <div className={`${WARNING_CLASS}${possibleDoxxing ? " privacy-toolkit-high-risk" : ""}`} role="status">
            <strong>{possibleDoxxing ? "PrivacyToolkit warning: possible doxxing pattern" : "PrivacyToolkit detected potentially sensitive information"}</strong>
            <span>{labels.join(" · ")}</span>
            <small>{possibleDoxxing
                ? "Multiple personal-data types or a known IP-logging link plus personal data were found. This is a heuristic warning, not proof of intent."
                : "Local scan only. DOM redaction is best-effort; check images, embeds, and quoted content manually."}</small>
        </div>
    );
}


function ExposureGuardAbout() {
    return (
        <div className="privacy-toolkit-about">
            <h3>App Authorization Guard</h3>
            <p>
                Before a standard Discord OAuth2 authorization link is opened from inside Discord, PrivacyToolkit
                checks the requested OAuth scopes and bot permission bits. When it sees email access, account identity,
                connected accounts, server or message access, bot installation, or powerful server permissions, it
                pauses the click and shows a confirmation with the requested access. <strong>Cancel authorization</strong>
                is the safe default; <strong>Continue anyway</strong> replays the original action.
            </p>
            <p>
                Data made available to an app or bot may be logged, retained, copied into private databases or channels
                controlled by its operator, or misused. Are you sure you trust this developer with the requested access?
                PrivacyToolkit cannot inspect an app's private storage, verify its privacy policy, or prevent data handling
                after Discord grants access. This guard covers recognizable Discord OAuth2 authorization links handled
                inside the client; it cannot reliably intercept authorizations completed in an external browser, on
                another device, or through a nonstandard flow.
            </p>
            <h3>OPSEC Center — reduce accidental exposure</h3>
            <p>
                OPSEC Center combines local detection with six defensive privacy modules. All ImageGuard analysis is local:
                automatic scans inspect pending image files before upload when the Vencord upload hook matches, and a manual
                scan button appears beside the composer when images are attached. OCR and QR detection depend on the
                Discord/Electron browser APIs available in your build. A missing API is reported as an unavailable check,
                never as a clean result.
            </p>
            <p>
                ImageGuard checks visible text where on-device OCR exists, QR payloads where BarcodeDetector exists,
                and EXIF/GPS metadata in original image files. It warns by default and does not modify files. Optional
                blocking removes flagged images from the pending draft; it is disabled by default.
            </p>
            <p>
                It does not search the web, query OSINT services, remove public records, hide your Discord account
                from Discord, or prevent another person from searching for information that is already public.
                It does not submit your watchlist to an OSINT lookup service.
            </p>

            {settings.store.opsecCompartmentalization && <>
                <h4>1. Identity compartmentalization</h4>
                <ol>
                <li>Use distinct usernames, avatars, bios, and profile links for accounts you do not want casually connected.</li>
                <li>Avoid reusing recovery emails, phone numbers, public handles, and profile photos across unrelated identities.</li>
                <li>Review mutual servers, friends, badges, and public profile details that can connect accounts.</li>
                </ol>
            </>}
            {settings.store.opsecMetadata && <>
                <h4>2. Metadata protection</h4>
                <ol>
                    <li>ImageGuard inspects local image files for EXIF and GPS metadata before upload when enabled.</li>
                    <li>ImageGuard currently warns; it does not silently rewrite image pixels or strip metadata. Remove flagged metadata from an edited copy before sharing.</li>
                    <li>Screenshots can reveal location through visible maps, windows, reflections, notifications, and background details even without metadata.</li>
                </ol>
            </>}
            {settings.store.opsecLinks && <>
                <h4>3. Link privacy</h4>
                <ol>
                    <li>Review links containing tracking parameters such as utm_*, fbclid, gclid, or referral IDs before sharing.</li>
                    <li>Be cautious with unfamiliar redirects, URL shorteners, file-hosting links, and QR codes. QR payload inspection depends on browser support.</li>
                    <li>Do not open suspicious links just to test them. PrivacyToolkit uses local pattern checks and does not resolve or visit links.</li>
                </ol>
            </>}
            {settings.store.opsecFootprint && <>
                <h4>4. Digital-footprint review</h4>
                <ol>
                    <li>Search for your current and former usernames, aliases, public email addresses, and profile-photo reuse.</li>
                    <li>Use <a href="https://myactivity.google.com/results-about-you" target="_blank" rel="noreferrer">Google Results about you</a> to monitor eligible contact details and request removal from Search.</li>
                    <li>Follow the <a href="https://consumer.ftc.gov/articles/what-know-about-people-search-sites-sell-your-information" target="_blank" rel="noreferrer">FTC people-search opt-out guide</a> and submit removal requests directly to data brokers.</li>
                </ol>
            </>}
            {settings.store.opsecAccount && <>
                <h4>5. Account-security audit</h4>
                <ol>
                    <li>Enable a passkey or authenticator-based multi-factor authentication where supported; store recovery codes offline.</li>
                    <li>Review active sessions, authorized applications, connected accounts, and bot/app permissions; revoke anything you do not recognize.</li>
                    <li>Use a unique password from a password manager and secure the email account used for recovery.</li>
                    <li>Review Discord's privacy, friend-request, server-DM, and activity-sharing settings periodically.</li>
                </ol>
            </>}
            {settings.store.opsecResponse && <>
                <h4>6. Exposure response</h4>
                <ol>
                    <li>Stop resharing the exposed content. Save URLs, timestamps, and evidence privately without reposting personal information.</li>
                    <li>Remove or edit the original post where possible, then ask moderators or the hosting service to remove copies. Search caches and mirrors may persist.</li>
                    <li>If a password, token, or recovery code was exposed, revoke it immediately and secure the affected account from a trusted device.</li>
                    <li>If a home address, phone number, or credible threat is involved, tell a trusted person and contact the relevant platform or local authorities when appropriate.</li>
                    <li>Recheck linked accounts, recovery methods, sessions, and public profiles for follow-on exposure.</li>
                </ol>
            </>}
            <h4>Discord account privacy checklist</h4>
            <ol>
                <li>
                    <strong>Profile Privacy:</strong> Open User Settings → Data &amp; Privacy → Profile Privacy
                    and consider <strong>Friends Only</strong>. Your avatar, banner, display name, username,
                    server tag, account age, and mutual friends/servers may still be visible.
                </li>
                <li>
                    <strong>Friend Requests:</strong> Open User Settings → Content &amp; Social → Friend Requests.
                    Disable Everyone, Friends of Friends, and Server Members as appropriate; disabling all three
                    prevents new friend requests from those categories.
                </li>
                <li>
                    <strong>Server DMs:</strong> Under Content &amp; Social → Social Permissions, turn off DMs
                    from server members and apply the change to existing servers when Discord offers that option.
                    Check per-server privacy settings too.
                </li>
                <li>
                    <strong>Activity Sharing:</strong> Review Activity Privacy separately. Profile Privacy and
                    Activity Sharing are distinct controls.
                </li>
            </ol>
            <p>
                <a href="https://support.discord.com/hc/en-us/articles/38859942749463-Profile-Privacy-Setting-on-Discord" target="_blank" rel="noreferrer">Discord: Profile Privacy settings</a>
                <br />
                <a href="https://support.discord.com/hc/en-us/articles/217916488-Blocking-Privacy-Settings" target="_blank" rel="noreferrer">Discord: Blocking, DMs, and friend requests</a>
            </p>

            <h4>Reduce your public-data footprint</h4>
            <ol>
                <li>
                    Use <a href="https://myactivity.google.com/results-about-you" target="_blank" rel="noreferrer">Google Results about you</a>
                    to monitor search results and request removal of eligible contact details or government ID information.
                    Search removal does not erase the original webpage.
                </li>
                <li>
                    Follow the <a href="https://consumer.ftc.gov/articles/what-know-about-people-search-sites-sell-your-information" target="_blank" rel="noreferrer">FTC people-search opt-out guide</a>
                    to submit opt-out requests directly to data-broker sites. Public records may remain available and information can reappear.
                </li>
                <li>
                    Avoid reusing the same username, avatar, bio, or contact details across public and personal accounts.
                    Add reused handles to Custom protected terms so Exposure Guard can flag them when you are about to share them.
                </li>
            </ol>
            <p className="privacy-toolkit-about-note">
                Privacy settings and removal requests must be completed by you on Discord, Google, and the relevant data-broker websites.
                PrivacyToolkit provides reminders and local warnings; it cannot change those services' account settings for you.
            </p>
            <h4>Feedback and bug reports</h4>
            <p>
                <a href="https://github.com/whipout3938-rgb/CurrentlyLOCALPrivacyToolkit/issues/new/choose" target="_blank" rel="noreferrer">Send feedback to the PrivacyToolkit makers on GitHub</a>.
                Include your PrivacyToolkit version, Vencord build date, steps to reproduce, and any error text. Never attach
                real personal information, account tokens, private recordings, or unredacted images.
            </p>
        </div>
    );
}

// -----------------------------------------------------------------------------
// Consent-gated local call recorder
//
// The desktop-audio source is obtained through getDisplayMedia. The user must
// choose a screen and enable system-audio sharing in Chromium's own picker.
// This can capture all audio from that display/device, not just Discord.
// Nothing is uploaded. Three audio-only WebM files are written locally.
// -----------------------------------------------------------------------------

type RecorderPhase = "idle" | "consent" | "requesting" | "recording" | "saving" | "error";
type RecorderPart = { recorder: MediaRecorder; chunks: Blob[] };
type RecorderSession = {
    desktopStream: MediaStream;
    microphoneStream: MediaStream;
    audioContext: AudioContext;
    parts: { combined: RecorderPart; microphone: RecorderPart; desktop: RecorderPart };
    folder?: any;
    startedAt: number;
    mimeType: string;
};

let recorderPanel: HTMLElement | undefined;
let recorderRestoreButton: HTMLButtonElement | undefined;
let recorderPhase: RecorderPhase = "idle";
let recorderSession: RecorderSession | undefined;
let recorderTimer: ReturnType<typeof setInterval> | undefined;
let recorderConsentConfirmed = false;
let recorderFolder: any;
let recorderStatus = "";
let recorderAutoStopping = false;

function formatRecordingTime(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    return [hours, minutes, seconds].map(value => String(value).padStart(2, "0")).join(":");
}

function recorderButton(label: string, className: string, action: () => void, disabled = false): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", action);
    return button;
}

function renderCallRecorderPanel() {
    if (!recorderPanel) return;
    recorderPanel.replaceChildren();

    const header = document.createElement("div");
    header.className = "privacy-toolkit-recorder-header";
    const title = document.createElement("strong");
    title.textContent = "PrivacyToolkit Call Recorder";
    const close = recorderButton("–", "privacy-toolkit-recorder-close", () => {
        if (recorderPhase === "recording" || recorderPhase === "saving") return;
        recorderPanel?.classList.add("privacy-toolkit-recorder-hidden");
        if (!recorderRestoreButton && document.body) {
            recorderRestoreButton = recorderButton("PrivacyToolkit Recorder", "privacy-toolkit-recorder-restore", () => {
                recorderPanel?.classList.remove("privacy-toolkit-recorder-hidden");
                recorderRestoreButton?.remove();
                recorderRestoreButton = undefined;
            });
            recorderRestoreButton.setAttribute("aria-label", "Show PrivacyToolkit Call Recorder");
            document.body.append(recorderRestoreButton);
        }
    });
    close.setAttribute("aria-label", "Minimize recorder panel");
    header.append(title, close);
    recorderPanel.append(header);

    const body = document.createElement("div");
    body.className = "privacy-toolkit-recorder-body";
    recorderPanel.append(body);

    if (recorderPhase === "idle") {
        const description = document.createElement("p");
        description.textContent = "Join the call first, then record your microphone and desktop audio locally. Nothing is captured until you confirm consent and arm the recorder.";
        body.append(description, recorderButton("Arm Call", "privacy-toolkit-recorder-primary", () => {
            recorderConsentConfirmed = false;
            recorderPhase = "consent";
            recorderStatus = "";
            renderCallRecorderPanel();
        }));
        const hint = document.createElement("small");
        hint.textContent = recorderFolder ? `Save folder selected: ${recorderFolder.name}` : "Default save location: your Downloads folder.";
        body.append(hint);
        return;
    }

    if (recorderPhase === "consent") {
        const warning = document.createElement("p");
        warning.className = "privacy-toolkit-recorder-warning";
        warning.textContent = "Recording captures your microphone plus desktop/system audio. System audio can include Discord, other apps, alerts, and nearby voices. Tell everyone before recording and obtain their agreement. Follow the recording laws that apply to you.";
        body.append(warning);

        const consentLabel = document.createElement("label");
        consentLabel.className = "privacy-toolkit-recorder-consent";
        const consent = document.createElement("input");
        consent.type = "checkbox";
        consent.checked = recorderConsentConfirmed;
        consent.addEventListener("change", () => {
            recorderConsentConfirmed = consent.checked;
            body.querySelectorAll<HTMLButtonElement>("[data-arm]").forEach(button => button.disabled = !recorderConsentConfirmed);
        });
        const consentText = document.createElement("span");
        consentText.textContent = "I have informed everyone who may be recorded, and everyone has agreed.";
        consentLabel.append(consent, consentText);
        body.append(consentLabel);

        const arm = recorderButton(
            recorderFolder ? "Arm Call — Save to selected folder" : "Arm Call — Save to Downloads",
            "privacy-toolkit-recorder-primary",
            () => void startCallRecording(),
            !recorderConsentConfirmed
        );
        arm.dataset.arm = "true";
        body.append(arm);
        const chooseFolder = recorderButton("Choose a save folder…", "privacy-toolkit-recorder-secondary", () => void chooseRecorderFolder());
        body.append(chooseFolder);
        if (recorderFolder) {
            body.append(recorderButton("Use Downloads instead", "privacy-toolkit-recorder-text-button", () => {
                recorderFolder = undefined;
                renderCallRecorderPanel();
            }));
        }
        body.append(recorderButton("Cancel", "privacy-toolkit-recorder-text-button", () => {
            recorderPhase = "idle";
            recorderConsentConfirmed = false;
            renderCallRecorderPanel();
        }));
        return;
    }

    if (recorderPhase === "requesting") {
        const status = document.createElement("p");
        status.textContent = recorderStatus || "Requesting microphone and desktop-audio access…";
        body.append(status);
        return;
    }

    if (recorderPhase === "recording" && recorderSession) {
        const live = document.createElement("div");
        live.className = "privacy-toolkit-recorder-live";
        const dot = document.createElement("span");
        dot.className = "privacy-toolkit-recorder-live-dot";
        const liveText = document.createElement("strong");
        liveText.textContent = "RECORDING";
        live.append(dot, liveText);
        body.append(live);

        const timer = document.createElement("div");
        timer.className = "privacy-toolkit-recorder-timer";
        timer.textContent = formatRecordingTime(Date.now() - recorderSession.startedAt);
        body.append(timer);
        const details = document.createElement("p");
        details.textContent = "Microphone + desktop audio · three local audio files · no upload";
        body.append(details);
        body.append(recorderButton("Stop & Save Recording", "privacy-toolkit-recorder-stop", () => void stopCallRecording()));
        const warning = document.createElement("small");
        warning.textContent = "The red indicator stays visible while recording. Stop sharing desktop audio to end capture as well.";
        body.append(warning);
        return;
    }

    if (recorderPhase === "saving") {
        const status = document.createElement("p");
        status.textContent = recorderStatus || "Saving the combined and separate audio tracks…";
        body.append(status);
        return;
    }

    const error = document.createElement("p");
    error.className = "privacy-toolkit-recorder-warning";
    error.textContent = recorderStatus || "The recorder could not start. Check microphone and desktop-audio permissions.";
    body.append(error, recorderButton("Try Again", "privacy-toolkit-recorder-primary", () => {
        recorderPhase = "consent";
        recorderConsentConfirmed = false;
        renderCallRecorderPanel();
    }), recorderButton("Dismiss", "privacy-toolkit-recorder-text-button", () => {
        recorderPhase = "idle";
        recorderStatus = "";
        renderCallRecorderPanel();
    }));
}

function mountCallRecorderPanel() {
    if (recorderPanel?.isConnected) return;
    if (!document.body) {
        document.addEventListener("DOMContentLoaded", mountCallRecorderPanel, { once: true });
        return;
    }
    const panel = document.createElement("section");
    recorderPanel = panel;
    panel.className = "privacy-toolkit-recorder-panel";
    panel.setAttribute("aria-label", "PrivacyToolkit Call Recorder");
    panel.setAttribute("aria-live", "polite");
    document.body.append(panel);
    renderCallRecorderPanel();
}

async function chooseRecorderFolder() {
    const picker = (window as any).showDirectoryPicker as undefined | ((options?: any) => Promise<any>);
    if (!picker) {
        recorderStatus = "Custom folder selection is not available in this Discord build. Use the Downloads option instead.";
        showNotice(recorderStatus);
        return;
    }

    try {
        // This function is called directly by the folder button, satisfying the
        // browser's user-activation requirement for a directory picker.
        recorderFolder = await picker({ mode: "readwrite" });
        recorderStatus = "";
        showNotice(`PrivacyToolkit recordings will be saved in: ${recorderFolder.name}`);
        renderCallRecorderPanel();
    } catch (error) {
        if ((error as Error)?.name !== "AbortError") {
            recorderStatus = "Could not select that folder. You can still save to Downloads.";
            showNotice(recorderStatus);
            renderCallRecorderPanel();
        }
    }
}

function makeRecorderPart(stream: MediaStream, mimeType: string): RecorderPart {
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: Blob[] = [];
    recorder.addEventListener("dataavailable", event => {
        if (event.data && event.data.size > 0) chunks.push(event.data);
    });
    return { recorder, chunks };
}

function chooseAudioMimeType(): string {
    const candidates = ["audio/webm;codecs=opus", "audio/webm"];
    for (const candidate of candidates) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) return candidate;
    }
    return "";
}

async function startCallRecording() {
    if (!recorderConsentConfirmed || recorderPhase === "recording" || recorderPhase === "requesting") return;
    if (!navigator.mediaDevices?.getDisplayMedia || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        recorderPhase = "error";
        recorderStatus = "This Discord build does not expose the required desktop-audio, microphone, or MediaRecorder APIs.";
        renderCallRecorderPanel();
        return;
    }

    recorderPhase = "requesting";
    recorderStatus = "Choose your entire screen and enable its system-audio sharing option in the next picker. Desktop audio may include other apps. Video is not recorded or saved.";
    renderCallRecorderPanel();

    let desktopStream: MediaStream | undefined;
    let microphoneStream: MediaStream | undefined;
    let audioContext: AudioContext | undefined;
    let createdRecorders: MediaRecorder[] = [];

    try {
        // getDisplayMedia must be invoked from the direct Arm button click.
        desktopStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true, systemAudio: "include", windowAudio: "system" } as any);
        const desktopAudioTracks = desktopStream.getAudioTracks();
        if (!desktopAudioTracks.length) {
            throw new Error("No desktop audio was selected. Choose Entire Screen and enable Share system audio, then try again.");
        }

        // The video track is stopped immediately and is never passed to a recorder.
        desktopStream.getVideoTracks().forEach(track => track.stop());

        recorderStatus = "Requesting microphone access…";
        renderCallRecorderPanel();
        const micStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: false
        });
        microphoneStream = micStream;

        const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextCtor) throw new Error("Web Audio mixing is not supported by this Discord build.");
        const context = new AudioContextCtor() as AudioContext;
        audioContext = context;
        if (context.state === "suspended") await context.resume();

        const mixedDestination = context.createMediaStreamDestination();
        const microphoneSource = context.createMediaStreamSource(new MediaStream(micStream.getAudioTracks()));
        const desktopSource = context.createMediaStreamSource(new MediaStream(desktopAudioTracks));
        microphoneSource.connect(mixedDestination);
        desktopSource.connect(mixedDestination);

        const mimeType = chooseAudioMimeType();
        if (!mimeType) throw new Error("This Discord build does not support audio/webm recording.");
        const session: RecorderSession = {
            desktopStream,
            microphoneStream: micStream,
            audioContext: context,
            parts: {
                combined: makeRecorderPart(mixedDestination.stream, mimeType),
                microphone: makeRecorderPart(new MediaStream(micStream.getAudioTracks()), mimeType),
                desktop: makeRecorderPart(new MediaStream(desktopAudioTracks), mimeType)
            },
            folder: recorderFolder,
            startedAt: Date.now(),
            mimeType
        };

        recorderSession = session;
        createdRecorders = Object.values(session.parts).map(part => part.recorder);
        for (const recorder of createdRecorders) recorder.start(1000);
        recorderPhase = "recording";
        recorderStatus = "";
        recorderTimer = setInterval(() => {
            if (!recorderPanel || !recorderSession || recorderPhase !== "recording") return;
            const timer = recorderPanel.querySelector<HTMLElement>(".privacy-toolkit-recorder-timer");
            if (timer) timer.textContent = formatRecordingTime(Date.now() - recorderSession.startedAt);
        }, 250);

        // If the user stops desktop sharing or the mic disappears, finish and
        // save all files rather than silently continuing with an incomplete mix.
        for (const track of [...desktopAudioTracks, ...microphoneStream.getAudioTracks()]) {
            track.addEventListener("ended", () => {
                if (recorderSession === session && !recorderAutoStopping) {
                    recorderAutoStopping = true;
                    void stopCallRecording().finally(() => recorderAutoStopping = false);
                }
            }, { once: true });
        }
        renderCallRecorderPanel();
        showNotice("PrivacyToolkit Call Recorder is recording locally. A red recording indicator is visible on screen.");
    } catch (error) {
        for (const recorder of createdRecorders) {
            if (recorder.state !== "inactive") {
                try { recorder.stop(); } catch { /* ignore cleanup errors */ }
            }
        }
        desktopStream?.getTracks().forEach(track => track.stop());
        microphoneStream?.getTracks().forEach(track => track.stop());
        if (audioContext && audioContext.state !== "closed") await audioContext.close().catch(() => undefined);
        recorderSession = undefined;
        recorderPhase = "error";
        recorderStatus = error instanceof Error ? error.message : "Recording could not start. Check capture permissions and try again.";
        renderCallRecorderPanel();
        showNotice(`PrivacyToolkit recorder: ${recorderStatus}`);
    }
}

async function writeRecordingBlob(filename: string, blob: Blob, folder?: any) {
    if (!blob.size) throw new Error(`The ${filename} audio track is empty.`);
    if (folder) {
        const fileHandle = await folder.getFileHandle(filename, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
    }

    // Fallback uses the browser's normal download destination (usually Downloads).
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = "none";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function stopCallRecording() {
    const session = recorderSession;
    if (!session || recorderPhase !== "recording") return;

    recorderPhase = "saving";
    recorderStatus = "Finalizing the combined and separate audio tracks…";
    if (recorderTimer) clearInterval(recorderTimer);
    recorderTimer = undefined;
    renderCallRecorderPanel();

    try {
        const parts = Object.values(session.parts);
        await Promise.all(parts.map(part => new Promise<void>(resolve => {
            if (part.recorder.state === "inactive") return resolve();
            part.recorder.addEventListener("stop", () => resolve(), { once: true });
            try { part.recorder.stop(); } catch { resolve(); }
        })));

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const extension = session.mimeType.includes("ogg") ? "ogg" : "webm";
        const outputs = [
            { suffix: "combined", part: session.parts.combined },
            { suffix: "microphone", part: session.parts.microphone },
            { suffix: "desktop-audio", part: session.parts.desktop }
        ];
        for (const output of outputs) {
            const blob = new Blob(output.part.chunks, { type: session.mimeType });
            await writeRecordingBlob(`PrivacyToolkit-${timestamp}-${output.suffix}.${extension}`, blob, session.folder);
        }

        showNotice(session.folder
            ? `PrivacyToolkit saved three audio recordings in ${session.folder.name}.`
            : "PrivacyToolkit saved three audio recordings to your Downloads location.");
        recorderStatus = "Saved three files: combined, microphone-only, and desktop-audio-only.";
    } catch (error) {
        recorderStatus = error instanceof Error ? `Recording stopped, but saving failed: ${error.message}` : "Recording stopped, but saving failed.";
        showNotice(`PrivacyToolkit recorder: ${recorderStatus}`);
    } finally {
        session.desktopStream.getTracks().forEach(track => track.stop());
        session.microphoneStream.getTracks().forEach(track => track.stop());
        if (session.audioContext.state !== "closed") await session.audioContext.close().catch(() => undefined);
        recorderSession = undefined;
        recorderPhase = "idle";
        recorderConsentConfirmed = false;
        renderCallRecorderPanel();
    }
}

function unmountCallRecorderPanel() {
    if (recorderPhase === "recording") void stopCallRecording();
    recorderPanel?.remove();
    recorderPanel = undefined;
    recorderRestoreButton?.remove();
    recorderRestoreButton = undefined;
    if (recorderTimer) clearInterval(recorderTimer);
    recorderTimer = undefined;
}

export default definePlugin({
    name: "PrivacyToolkit",
    description: "Local privacy tools for Discord, including App Authorization Guard, ImageGuard, OPSEC Center, Exposure Guard, message warnings and redaction, group-DM controls, and consent-gated call recording. Not a guarantee against disclosure.",
    authors: [{ name: "PrivacyToolkit contributors", id: 0n }],
    tags: ["Privacy", "Utility"],
    settings,
    settingsAboutComponent: ExposureGuardAbout,
    dependencies: ["MessageEventsAPI"],
    chatBarButton: {
        icon: ImageGuardIcon,
        render: makeImageGuardChatBarButton(settings, scanText, showNotice)
    },
    patches: [
        {
            // Vencord's uploadFiles path receives CloudUpload instances whose
            // item.file is the local File. Inspect it before upload begins.
            find: "async uploadFiles(",
            replacement: {
                match: /async uploadFiles\((\i)\){/,
                replace: "async uploadFiles($1){await $self.scanUploads($1);"
            }
        }
    ],
    scanUploads(uploads: CloudUpload[]) {
        return scanPendingImageUploads(uploads, settings, scanText, showNotice);
    },

    onBeforeMessageSend(_channelId, messageObj) {
        return inspectOutgoingMessage(messageObj);
    },

    onBeforeMessageEdit(_channelId, _messageId, messageObj) {
        return inspectOutgoingMessage(messageObj);
    },

    renderMessageAccessory: props => (
        <PrivacyToolkitAccessory message={props.message as Message} />
    ),

    flux: {
        CHANNEL_CREATE({ channel }: { channel: GroupDmChannel }) {
            if (channel) void handleGroupDmCreate(channel);
        },
        CHANNEL_RECIPIENT_ADD(event: RecipientAddEvent) {
            void handleCurrentUserAddedToGroupDm(event);
        }
    },

    start() {
        if (settings.store.protectIncoming) startDomProtection();
        void initializeGroupDmProtection();
        void checkForUpdates();
        updateTimer = setInterval(() => void checkForUpdates(), UPDATE_CHECK_INTERVAL_MS);
        mountCallRecorderPanel();
        startAuthorizationGuard(settings);
    },

    stop() {
        stopDomProtection();
        if (updateTimer) clearInterval(updateTimer);
        updateTimer = undefined;
        unmountCallRecorderPanel();
        stopAuthorizationGuard();
    }
});
