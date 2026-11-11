/*
 * PrivacyToolkit ImageGuard
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * All image inspection runs locally in the Discord client.
 */
import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import type { CloudUpload } from "@vencord/discord-types";
import { DraftType, UploadAttachmentStore } from "@webpack/common";

type ScanText = (input: string) => { labels: string[] };
type Notice = (message: string) => void;

type ImageGuardConfig = {
    store: {
        imageGuardEnabled: boolean;
        imageGuardAutoScan: boolean;
        imageGuardManualScan: boolean;
        imageGuardBlockOnFindings: boolean;
        detectImageMetadata: boolean;
        opsecMetadata: boolean;
    };
};

type ImageScanResult = {
    filename: string;
    findings: string[];
    checks: string[];
};

function findAscii(bytes: Uint8Array, value: string): number {
    const needle = new TextEncoder().encode(value);
    outer: for (let i = 0; i <= bytes.length - needle.length; i++) {
        for (let j = 0; j < needle.length; j++) {
            if (bytes[i + j] !== needle[j]) continue outer;
        }
        return i;
    }
    return -1;
}

function exifHasGps(bytes: Uint8Array, markerOffset: number, prefixLength: number): boolean {
    try {
        let tiff = markerOffset + prefixLength;
        if (bytes[tiff] === 0x45 && bytes[tiff + 1] === 0x78) tiff += 6;
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
        if (!little && !(bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d)) return false;
        const u16 = (offset: number) => view.getUint16(offset, little);
        const u32 = (offset: number) => view.getUint32(offset, little);
        if (u16(tiff + 2) !== 42) return false;
        let ifd = tiff + u32(tiff + 4);
        for (let depth = 0; depth < 4 && ifd + 2 <= bytes.length; depth++) {
            const count = Math.min(u16(ifd), 512);
            for (let i = 0; i < count; i++) {
                const entry = ifd + 2 + i * 12;
                if (entry + 12 > bytes.length) return false;
                if (u16(entry) === 0x8825) return true;
            }
            const next = ifd + 2 + count * 12;
            if (next + 4 > bytes.length) return false;
            const nextIfd = u32(next);
            if (!nextIfd) break;
            ifd = tiff + nextIfd;
        }
    } catch {
        return false;
    }
    return false;
}

async function scanImageFile(file: File, config: ImageGuardConfig, scanText: ScanText): Promise<ImageScanResult> {
    const result: ImageScanResult = { filename: file.name || "image", findings: [], checks: [] };
    if (!file.type.startsWith("image/") && !/\.(png|jpe?g|webp|gif|bmp|avif|heic)$/i.test(file.name)) {
        result.checks.push("not recognized as an image");
        return result;
    }

    const filenameMatches = scanText(file.name || "").labels;
    if (filenameMatches.length) result.findings.push(...filenameMatches.map(label => "filename: " + label));

    try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (config.store.detectImageMetadata && config.store.opsecMetadata) {
            const exif = findAscii(bytes, "Exif\u0000\u0000");
            const pngExif = findAscii(bytes, "eXIf");
            const webpExif = findAscii(bytes, "EXIF");
            if (exif >= 0 || pngExif >= 0 || webpExif >= 0) {
                result.findings.push("EXIF metadata present (may include device, date, or location details)");
                const marker = exif >= 0 ? exif : pngExif >= 0 ? pngExif : webpExif;
                if (exifHasGps(bytes, marker, exif >= 0 ? 6 : 4)) result.findings.push("GPS location metadata present");
            }
            result.checks.push("metadata inspection completed");
        }

        let bitmap: ImageBitmap | undefined;
        try {
            bitmap = await createImageBitmap(file);
            const TextDetectorCtor = (window as any).TextDetector;
            if (TextDetectorCtor) {
                const detector = new TextDetectorCtor();
                const blocks = await detector.detect(bitmap);
                const visibleText = blocks.map((block: { rawValue?: string; }) => block.rawValue || "").filter(Boolean).join("\n");
                if (visibleText) {
                    const matches = scanText(visibleText).labels;
                    result.findings.push(...matches.map(label => "visible image text: " + label));
                }
                result.checks.push("on-device OCR completed");
            } else {
                result.checks.push("OCR unavailable in this Discord/Electron build");
            }

            const BarcodeDetectorCtor = (window as any).BarcodeDetector;
            if (BarcodeDetectorCtor) {
                try {
                    const detector = new BarcodeDetectorCtor({ formats: ["qr_code"] });
                    const codes = await detector.detect(bitmap);
                    for (const code of codes) {
                        const payload = String(code.rawValue || "");
                        const matches = payload ? scanText(payload).labels : [];
                        if (matches.length) result.findings.push(...matches.map(label => "QR payload: " + label));
                        else result.findings.push("QR code detected; review its destination or contents");
                    }
                    result.checks.push("QR scan completed");
                } catch {
                    result.checks.push("QR scanning unavailable");
                }
            } else {
                result.checks.push("QR scanning unavailable in this Discord/Electron build");
            }
        } finally {
            bitmap?.close();
        }
    } catch {
        result.checks.push("file could not be read or decoded locally");
    }

    result.findings = [...new Set(result.findings)];
    return result;
}

async function inspectUploads(uploads: CloudUpload[], config: ImageGuardConfig, scanText: ScanText, showNotice: Notice) {
    if (!config.store.imageGuardEnabled) return;
    const images = uploads.filter(upload => upload.isImage && upload.item?.file instanceof File);
    if (!images.length) return;

    const results = await Promise.all(images.map(async upload => ({
        upload,
        result: await scanImageFile(upload.item.file, config, scanText)
    })));
    const flagged = results.filter(item => item.result.findings.length);
    const incomplete = results.some(item => item.result.checks.some(check => /unavailable|could not|failed/i.test(check)));

    if (flagged.length) {
        const details = flagged.map(item => item.result.filename + ": " + item.result.findings.join(", ")).join(" | ");
        showNotice("ImageGuard found possible exposure: " + details);
        if (config.store.imageGuardBlockOnFindings) {
            const blockedUploads = new Set(flagged.map(item => item.upload));
            for (const upload of blockedUploads) upload.removeFromMsgDraft();
            for (let index = uploads.length - 1; index >= 0; index--) {
                if (blockedUploads.has(uploads[index])) uploads.splice(index, 1);
            }
            showNotice("ImageGuard removed flagged image(s) from the pending draft and skipped their upload. Review them before re-adding.");
        }
    } else if (incomplete) {
        showNotice("ImageGuard checked pending images, but some OCR/QR or decoding checks were unavailable. Review them manually.");
    } else {
        showNotice("ImageGuard completed local image checks. No configured exposure patterns matched; this is not a guarantee that an image is safe.");
    }
}

export async function scanPendingImageUploads(uploads: CloudUpload[], config: ImageGuardConfig, scanText: ScanText, showNotice: Notice) {
    if (!config.store.imageGuardAutoScan) return;
    await inspectUploads(uploads, config, scanText, showNotice);
}

async function scanCurrentDraft(channelId: string, config: ImageGuardConfig, scanText: ScanText, showNotice: Notice) {
    const uploads = UploadAttachmentStore.getUploads(channelId, DraftType.ChannelMessage) as CloudUpload[];
    const images = uploads.filter(upload => upload.isImage && upload.item?.file instanceof File);
    if (!images.length) {
        showNotice("ImageGuard: there are no pending image attachments to scan.");
        return;
    }
    await inspectUploads(images, { ...config, store: { ...config.store, imageGuardAutoScan: true, imageGuardBlockOnFindings: false } }, scanText, showNotice);
}

export const ImageGuardIcon = () => (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path fill="currentColor" d="M12 2 3 6v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6l-9-4Zm0 3.1 6 2.67V11c0 4.15-2.7 8.1-6 9.3-3.3-1.2-6-5.15-6-9.3V7.77l6-2.67Zm-1 3.4v5.1l4 2.4.9-1.45-3.2-1.9V8.5H11Z" />
    </svg>
);

export function makeImageGuardChatBarButton(config: ImageGuardConfig, scanText: ScanText, showNotice: Notice): ChatBarButtonFactory {
    return ({ isAnyChat, channel }) => {
        if (!isAnyChat || !config.store.imageGuardEnabled || !config.store.imageGuardManualScan) return null;
        const uploads = UploadAttachmentStore.getUploads(channel.id, DraftType.ChannelMessage);
        if (!uploads.some((upload: CloudUpload) => upload.isImage)) return null;
        return (
            <ChatBarButton tooltip="Manually scan pending images with ImageGuard" onClick={() => void scanCurrentDraft(channel.id, config, scanText, showNotice)}>
                <ImageGuardIcon />
            </ChatBarButton>
        );
    };
}
