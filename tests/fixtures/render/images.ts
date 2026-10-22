import { deflateSync } from "node:zlib";
import type { RenderAsset } from "../../../src/lib/render";

// Synthetic image bytes for renderer tests. PNGs are generated here; the
// JPEG is a 12×8 baseline file made with Ghostscript and stripped of
// metadata. Nothing is fetched and no real memory is involved.

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes: Uint8Array) {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** An 8-bit RGB PNG: a two-tone diagonal so cropping is visible. */
export function makePng(
  width: number,
  height: number,
  a: [number, number, number],
  b: [number, number, number],
): Uint8Array {
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header.set([8, 2, 0, 0, 0], 8);
  const raw = new Uint8Array(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    const row = y * (1 + width * 3);
    for (let x = 0; x < width; x++)
      raw.set(x * height > y * width ? a : b, row + 1 + x * 3);
  }
  const parts = [
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", new Uint8Array(deflateSync(raw))),
    chunk("IEND", new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

export const tinyJpeg = new Uint8Array(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAA0JCgsKCA0LCgsODg0PEyAVExISEyccHhcgLikxMC4pLSwzOko+MzZGNywtQFdBRkxOUlNSMj5aYVpQYEpRUk//2wBDAQ4ODhMREyYVFSZPNS01T09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0//wAARCAAIAAwDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCpBe+bKsfl4z33VaoormzKhTo1VGmrK36s9PA1Z1ablN3dz//Z",
    "base64",
  ),
);

const png = (
  a: [number, number, number],
  b: [number, number, number],
  w = 16,
  h = 12,
): RenderAsset => ({ bytes: makePng(w, h, a, b), mimeType: "image/png" });

/** Decrypted stand-ins for every image the two fixture plans place. */
export function fixtureAssets(): Map<string, RenderAsset> {
  return new Map<string, RenderAsset>([
    ["version:ver-pier", png([232, 150, 90], [90, 120, 160], 24, 16)],
    ["version:ver-kitchen", { bytes: tinyJpeg, mimeType: "image/jpeg" }],
    ["derivative:drv-still-dance", png([200, 80, 60], [250, 210, 120], 12, 16)],
    ["version:ver-neon", png([255, 46, 136], [20, 20, 40], 16, 24)],
    ["version:ver-crowd", png([40, 40, 60], [19, 226, 208], 32, 18)],
    ["derivative:drv-still-encore", png([240, 240, 240], [255, 46, 136])],
    ["version:ver-booth", { bytes: tinyJpeg, mimeType: "image/jpeg" }],
  ]);
}

export const credits = new Map([
  ["person-maya", "Maya"],
  ["person-priya", "Priya"],
  ["person-leo", "Leo"],
]);
