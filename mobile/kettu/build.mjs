import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, "builds/privacytoolkit-mobile");
const source = resolve(root, "src/index.js");
const manifestSource = resolve(root, "src/manifest.json");

const code = (await readFile(source, "utf8")).trim();
if (!code.startsWith("(function")) {
    throw new Error("Plugin source must be a parenthesized expression for Kettu's Vendetta loader.");
}

const manifest = JSON.parse(await readFile(manifestSource, "utf8"));
const hash = createHash("sha256").update(code).digest("hex");

await mkdir(output, { recursive: true });
await writeFile(resolve(output, "index.js"), code + "\n");
await writeFile(
    resolve(output, "manifest.json"),
    JSON.stringify({ ...manifest, hash }, null, 2) + "\n"
);

console.log("Built PrivacyToolkit Mobile.");
console.log("Output: " + output);
console.log("SHA-256: " + hash);
