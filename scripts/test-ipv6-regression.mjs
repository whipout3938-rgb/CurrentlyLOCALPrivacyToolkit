import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
    new URL("../src/userplugins/privacytoolkit/index.tsx", import.meta.url),
    "utf8"
);

// Extract the production validator and candidate regexp so these tests exercise
// the exact IPv6 detection logic shipped by the plugin, not a copied test-only
// implementation.
const validatorMatch = source.match(
    /function isValidIpv6Address\(candidate: string\): boolean \{[\s\S]*?\n\}/
);
assert.ok(validatorMatch, "Production IPv6 validator must exist");

const validatorJavaScript = validatorMatch[0]
    .replace("candidate: string", "candidate")
    .replace(/:\s*boolean\s*\{/, " {");
const isValidIpv6Address = new Function(`return (${validatorJavaScript});`)();

const patternMatch = source.match(
    /label: "IPv6-like address",\s*pattern: (\/.*\/[a-z]*)/
);
assert.ok(patternMatch, "Production IPv6 candidate regexp must exist");

const regexLiteral = patternMatch[1];
const lastSlash = regexLiteral.lastIndexOf("/");
const ipv6CandidatePattern = new RegExp(
    regexLiteral.slice(1, lastSlash),
    regexLiteral.slice(lastSlash + 1)
);

function candidates(text) {
    ipv6CandidatePattern.lastIndex = 0;
    return [...text.matchAll(ipv6CandidatePattern)].map(match => match[0]);
}

function validCandidates(text) {
    return candidates(text).filter(isValidIpv6Address);
}

function redactValidIpv6(text) {
    ipv6CandidatePattern.lastIndex = 0;
    return text.replace(
        ipv6CandidatePattern,
        match => isValidIpv6Address(match) ? "[REDACTED]" : match
    );
}

const timestamps = [
    "1:23",
    "0:45 / 2:30",
    "1:02:33",
    "Video duration 12:34; current time 01:02:03",
    "Clip starts at 09:41 and ends at 10:12"
];

for (const timestamp of timestamps) {
    assert.deepEqual(
        validCandidates(timestamp),
        [],
        `Timestamp must not be detected as IPv6: ${timestamp}`
    );
    assert.equal(
        redactValidIpv6(timestamp),
        timestamp,
        `Timestamp must not be redacted: ${timestamp}`
    );
}

const validAddresses = [
    "::1",
    "2001:db8::1",
    "2001:0db8:0000:0000:0000:ff00:0042:8329",
    "fe80::abcd"
];

for (const address of validAddresses) {
    assert.ok(
        isValidIpv6Address(address),
        `Valid IPv6 literal should pass validation: ${address}`
    );
    assert.ok(
        validCandidates(`Server endpoint: ${address}`).includes(address),
        `Valid IPv6 literal should be detected: ${address}`
    );
}

assert.equal(
    isValidIpv6Address("1:23"),
    false,
    "A two-group timestamp-like value is not a complete IPv6 literal"
);
assert.equal(
    isValidIpv6Address("dead:beef"),
    false,
    "An incomplete two-hextet value is not a complete IPv6 literal"
);

const mixedMessage = "Progress 0:45 / 2:30 — endpoint 2001:db8::1 — total 1:02:33";
assert.equal(
    redactValidIpv6(mixedMessage),
    "Progress 0:45 / 2:30 — endpoint [REDACTED] — total 1:02:33",
    "Only the valid IPv6 address should be redacted in mixed media text"
);

console.log("IPv6 regression tests passed: timestamps stay visible; valid IPv6 is detected and redacted.");
