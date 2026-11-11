(function () {
    "use strict";

    // Kettu currently loads Vendetta-compatible plugins through its built-in
    // compatibility layer. This expression is evaluated with "vendetta"
    // supplied by Kettu's plugin loader.

    const storage = vendetta.plugin.storage;
    const logger = vendetta.logger || console;

    let unpatchSendMessage;
    let retryTimer;
    let stopped = false;
    let lastNoticeAt = 0;

    const REDACTED = "[REDACTED]";

    function ensureDefaults() {
        if (typeof storage.enabled !== "boolean") storage.enabled = true;
        if (typeof storage.autoRedact !== "boolean") storage.autoRedact = false;
        if (typeof storage.warnOnFindings !== "boolean") storage.warnOnFindings = true;
    }

    function isValidIpv6Address(candidate) {
        // Validate IPv6 candidates instead of treating every digit-colon
        // sequence (for example, a video timestamp like 1:23) as an address.
        try {
            const parsed = new URL("http://[" + candidate + "]/");
            return parsed.hostname.startsWith("[") && parsed.hostname.endsWith("]");
        } catch {
            return false;
        }
    }

    function overlapsMediaTimestamp(text, start, end) {
        // Video/audio labels commonly look like 1:23, 12:34, or 1:02:33.
        // They must not be mistaken for coordinate pairs such as "23 / 2".
        const timecode = /\b\d{1,3}:\d{2}(?::\d{2})?\b/g;
        let match;
        while ((match = timecode.exec(text)) !== null) {
            const timeStart = match.index;
            const timeEnd = timeStart + match[0].length;
            if (start < timeEnd && end > timeStart) return true;
        }
        return false;
    }

    function escapeRegExp(value) {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    function getRules() {
        const rules = [
            {
                label: "email address",
                pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
            },
            {
                label: "phone number",
                pattern: /\b(?:\+?1[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}\b/g
            },
            {
                label: "IPv4 address",
                pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g
            },
            {
                label: "IPv6 address",
                kind: "ipv6",
                pattern: /(?:(?:[a-f0-9]{1,4}:){2,7}:?[a-f0-9]{0,4}|::[a-f0-9]{1,4})/gi
            },
            {
                label: "US SSN-like number",
                pattern: /\b(?!000|666|9\d\d)\d{3}[- ]?(?!00)\d{2}[- ]?(?!0000)\d{4}\b/g
            },
            {
                label: "possible street address",
                pattern: /\b\d{1,6}\s+(?:[A-Z0-9.'-]+\s+){1,5}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl|Circle|Cir)\b\.?/gi
            },
            {
                label: "coordinate pair",
                kind: "coordinates",
                pattern: /\b[-+]?(?:[0-8]?\d(?:\.\d+)?|90(?:\.0+)?)\s*[,/]\s*[-+]?(?:1[0-7]\d(?:\.\d+)?|[1-9]?\d(?:\.\d+)?|180(?:\.0+)?)\b/g
            }
        ];

        const protectedTerms = typeof storage.protectedTerms === "string"
            ? storage.protectedTerms.split(/[\n\r,]+/).map(value => value.trim()).filter(value => value.length >= 2).slice(0, 100)
            : [];

        for (const term of protectedTerms) {
            rules.push({
                label: "custom protected term",
                pattern: new RegExp(escapeRegExp(term), "gi")
            });
        }

        return rules;
    }

    function scanText(input) {
        const labels = new Set();
        const replacements = [];

        for (const rule of getRules()) {
            rule.pattern.lastIndex = 0;
            for (const match of input.matchAll(rule.pattern)) {
                const value = match[0];
                const start = match.index || 0;
                const end = start + value.length;

                if (rule.kind === "ipv6" && !isValidIpv6Address(value)) continue;
                if (rule.kind === "coordinates" && overlapsMediaTimestamp(input, start, end)) continue;

                labels.add(rule.label);
                if (storage.autoRedact) replacements.push({ start, end });
            }
        }

        // Apply ranges from right to left so earlier offsets remain valid.
        replacements.sort((a, b) => a.start - b.start);
        const merged = [];
        for (const range of replacements) {
            const previous = merged[merged.length - 1];
            if (previous && range.start <= previous.end) {
                previous.end = Math.max(previous.end, range.end);
            } else {
                merged.push({ start: range.start, end: range.end });
            }
        }

        let output = input;
        for (let i = merged.length - 1; i >= 0; i--) {
            const range = merged[i];
            output = output.slice(0, range.start) + REDACTED + output.slice(range.end);
        }

        return { text: output, labels: Array.from(labels) };
    }

    function showFindingNotice(labels) {
        if (!storage.warnOnFindings) return;
        const now = Date.now();
        if (now - lastNoticeAt < 1200) return;
        lastNoticeAt = now;

        const message = "PrivacyToolkit found: " + labels.join(", ");
        try {
            const showToast = vendetta.ui && vendetta.ui.toasts && vendetta.ui.toasts.showToast;
            if (typeof showToast === "function") showToast(message);
            else logger.warn(message);
        } catch (error) {
            logger.warn("PrivacyToolkit could not display its warning toast.", error);
        }
    }

    function attachSendMessagePatch() {
        if (stopped || unpatchSendMessage) return Boolean(unpatchSendMessage);

        try {
            const messageActions = vendetta.metro && vendetta.metro.findByProps("sendMessage");
            if (!messageActions || typeof messageActions.sendMessage !== "function") return false;

            const before = vendetta.patcher && vendetta.patcher.before;
            if (typeof before !== "function") {
                logger.warn("PrivacyToolkit Mobile: Kettu's message patch API was unavailable.");
                return false;
            }

            unpatchSendMessage = before("sendMessage", messageActions, args => {
                if (stopped || !storage.enabled || !Array.isArray(args)) return;

                const message = args[1];
                const content = typeof message === "string"
                    ? message
                    : message && typeof message.content === "string"
                        ? message.content
                        : null;

                if (content === null || content.length === 0) return;

                const result = scanText(content);
                if (!result.labels.length) return;

                if (storage.autoRedact && result.text !== content) {
                    if (typeof message === "string") {
                        args[1] = result.text;
                    } else {
                        args[1] = Object.assign({}, message, { content: result.text });
                    }
                }

                showFindingNotice(result.labels);
            });

            logger.log("PrivacyToolkit Mobile: outgoing message scan attached.");
            return true;
        } catch (error) {
            logger.warn("PrivacyToolkit Mobile: could not attach outgoing message scan.", error);
            return false;
        }
    }

    function onLoad() {
        stopped = false;
        ensureDefaults();

        if (!attachSendMessagePatch()) {
            // Discord's send module may not be available at the first tick.
            retryTimer = setInterval(() => {
                if (attachSendMessagePatch() && retryTimer) {
                    clearInterval(retryTimer);
                    retryTimer = undefined;
                }
            }, 1500);
        }
    }

    function onUnload() {
        stopped = true;
        if (retryTimer) clearInterval(retryTimer);
        retryTimer = undefined;

        if (typeof unpatchSendMessage === "function") {
            try {
                unpatchSendMessage();
            } catch (error) {
                logger.warn("PrivacyToolkit Mobile: failed to remove message patch.", error);
            }
        }
        unpatchSendMessage = undefined;
    }

    function Settings() {
        const React = vendetta.metro.common.React;
        const ReactNative = vendetta.metro.common.ReactNative;
        const Forms = vendetta.ui.components.Forms;
        vendetta.storage.useProxy(storage);

        const h = React.createElement;
        return h(
            ReactNative.ScrollView,
            { contentContainerStyle: { paddingBottom: 24 } },
            h(
                Forms.FormSection,
                { title: "Outgoing Message Protection" },
                h(Forms.FormSwitchRow, {
                    label: "Enable outgoing message scanning",
                    subLabel: "Check messages locally before they are sent.",
                    value: storage.enabled !== false,
                    onValueChange: value => { storage.enabled = value; }
                }),
                h(Forms.FormSwitchRow, {
                    label: "Automatically redact findings",
                    subLabel: "Replace detected values with [REDACTED]. Off by default; warnings do not change your message.",
                    value: storage.autoRedact === true,
                    onValueChange: value => { storage.autoRedact = value; }
                }),
                h(Forms.FormSwitchRow, {
                    label: "Show privacy warnings",
                    subLabel: "Display a local warning when a message contains a detected pattern.",
                    value: storage.warnOnFindings !== false,
                    onValueChange: value => { storage.warnOnFindings = value; }
                })
            ),
            h(
                Forms.FormSection,
                { title: "Mobile Beta Limitations" },
                h(Forms.FormRow, {
                    label: "Outgoing messages only",
                    subLabel: "This first mobile build scans the send action. It does not yet scan incoming chat, image uploads, OAuth authorization, or calls."
                }),
                h(Forms.FormRow, {
                    label: "Local processing",
                    subLabel: "Message text is inspected on this device. PrivacyToolkit does not send message content to a scanning server."
                })
            )
        );
    }

    return {
        onLoad,
        onUnload,
        settings: Settings
    };
})()
