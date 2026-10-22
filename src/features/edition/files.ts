import type { Candidate, Collection } from "@/features/prototype/types";

// Client-side placeholder files for the prototype. The real CH-13 endpoint
// returns the stored approved bytes; it never re-renders.

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function pdfFileName(collection: Collection, candidate: Candidate) {
  return `${slugify(collection.title)}-${candidate.editionId}.pdf`;
}

export function receiptFileName(candidate: Candidate) {
  return `${candidate.editionId}-receipt.json`;
}

function pdfText(text: string) {
  // ASCII only, with PDF string delimiters escaped.
  return text
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "")
    .replace(/[\\()]/g, (c) => `\\${c}`);
}

/**
 * Minimal valid single-page A5 PDF labeled as a prototype placeholder.
 * Deterministic for a candidate, so its digest can be checked offline.
 */
export function buildPlaceholderPdf(
  collection: Collection,
  candidate: Candidate,
): Uint8Array {
  const lines = [
    collection.title,
    `Edition ${candidate.editionId}`,
    "Chorus UI prototype placeholder file.",
    "The approved six-page photozine is not rendered in this prototype.",
    `Approved PDF digest: ${candidate.pdfDigest.slice(0, 32)}`,
    `                     ${candidate.pdfDigest.slice(32)}`,
  ];
  const content = [
    "BT",
    "/F1 12 Tf",
    "16 TL",
    "40 540 Td",
    ...lines.map((l) => `(${pdfText(l)}) Tj T*`),
    "ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 595] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets)
    out += `${String(off).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array) {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Public receipt. Contains digests, counts, and the signature only: no source
 * plaintext, no rejection explanations, and no contributor identities.
 */
export async function buildReceipt(
  collection: Collection,
  candidate: Candidate,
) {
  const receipt = candidate.receipt;
  if (!receipt) throw new Error("Candidate has not been issued.");
  const placeholder = await sha256Hex(
    buildPlaceholderPdf(collection, candidate),
  );
  return {
    type: "chorus-consent-receipt",
    version: "0.1-prototype",
    prototype: true,
    receiptId: receipt.id,
    editionId: candidate.editionId,
    issuedAt: receipt.issuedAt,
    pdfSha256: receipt.pdfDigest,
    manifestSha256: receipt.manifestDigest,
    approverCount: receipt.approverCount,
    permissionRevision: receipt.permissionRevision,
    downloadScope: { memberCount: candidate.downloadMemberIds.length },
    signature: receipt.signature,
    prototypePlaceholderSha256: placeholder,
    note: "Prototype receipt. The signature is synthetic, not a Tide signature. prototypePlaceholderSha256 is the digest of the placeholder PDF this prototype downloads.",
  };
}

export type ReceiptFile = Awaited<ReturnType<typeof buildReceipt>>;

export function saveFile(data: BlobPart, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
