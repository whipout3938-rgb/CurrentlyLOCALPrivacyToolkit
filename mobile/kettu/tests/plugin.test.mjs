import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = await readFile(resolve(root, "src/index.js"), "utf8");

function createHarness(initialStorage = {}) {
    const storage = { ...initialStorage };
    const messages = [];
    let beforeCallback;
    let removed = false;

    const messageActions = {
        sendMessage() {}
    };

    const vendetta = {
        plugin: { storage },
        logger: {
            log() {},
            warn() {},
            error() {}
        },
        metro: {
            findByProps(...props) {
                return props.includes("sendMessage") ? messageActions : undefined;
            },
            common: {
                React: { createElement() {}, useState() {}, useEffect() {} },
                ReactNative: {}
            }
        },
        patcher: {
            before(name, target, callback) {
                assert.equal(name, "sendMessage");
                assert.equal(target, messageActions);
                beforeCallback = callback;
                return () => {
                    removed = true;
                    beforeCallback = undefined;
                };
            }
        },
        ui: {
            toasts: {
                showToast(message) {
                    messages.push(message);
                }
            },
            components: {}
        },
        storage: {
            useProxy() {}
        }
    };

    const plugin = new Function("vendetta", "return " + source)(vendetta);
    plugin.onLoad();

    return {
        plugin,
        storage,
        messages,
        send(args) {
            assert.equal(typeof beforeCallback, "function", "sendMessage patch should be attached");
            beforeCallback(args);
            return args;
        },
        wasRemoved: () => removed
    };
}

test("does not flag duration and playback timecodes", () => {
    const h = createHarness();
    const args = ["channel-id", { content: "Video: 1:23 — progress 0:45 / 2:30 — total 1:02:33" }];
    h.send(args);
    assert.equal(args[1].content, "Video: 1:23 — progress 0:45 / 2:30 — total 1:02:33");
    assert.equal(h.messages.length, 0);
});

test("warns about a real IPv6 address but not a timestamp", () => {
    const h = createHarness();
    h.send(["channel-id", { content: "Server address: 2001:db8::1" }]);
    assert.equal(h.messages.length, 1);
    assert.match(h.messages[0], /IPv6 address/);
});

test("warns about email addresses without altering messages by default", () => {
    const h = createHarness();
    const args = ["channel-id", { content: "Contact me at person@example.com" }];
    h.send(args);
    assert.equal(args[1].content, "Contact me at person@example.com");
    assert.equal(h.messages.length, 1);
    assert.match(h.messages[0], /email address/);
});

test("redacts a detected value only when auto-redaction is enabled", () => {
    const h = createHarness({ autoRedact: true });
    const args = ["channel-id", { content: "Contact me at person@example.com" }];
    h.send(args);
    assert.equal(args[1].content, "Contact me at [REDACTED]");
});

test("honours the scan enable switch", () => {
    const h = createHarness({ enabled: false });
    h.send(["channel-id", { content: "person@example.com" }]);
    assert.equal(h.messages.length, 0);
});

test("removes its send hook when unloaded", () => {
    const h = createHarness();
    h.plugin.onUnload();
    assert.equal(h.wasRemoved(), true);
});
