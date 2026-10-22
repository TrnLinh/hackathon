// INTERIM, NOT ENCRYPTION. Until the CH-02 envelope exists, private metadata
// and payloads may use this labelled development format so the product flow
// works end to end. It is plain base64 of UTF-8 JSON: anyone with database
// access can read it. The backend accepts it only when the Convex deployment
// sets CHORUS_ALLOW_DEV_ENVELOPE=1, and the UI labels it "Not encrypted (dev)".
// See docs/public-api.md ("Interim dev envelope").

export const DEV_ENVELOPE_FORMAT = "chorus-dev-envelope/v0";
const PREFIX = `${DEV_ENVELOPE_FORMAT}:`;
/** Upper bound for an envelope string (bytes of base64 text). */
export const MAX_ENVELOPE_LENGTH = 16 * 1024;

export function isDevEnvelope(value: string) {
  return value.startsWith(PREFIX);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string) {
  return Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
}

export function sealDevEnvelope(value: unknown): string {
  const sealed =
    PREFIX + toBase64(new TextEncoder().encode(JSON.stringify(value)));
  if (sealed.length > MAX_ENVELOPE_LENGTH)
    throw new Error("Envelope is too large.");
  return sealed;
}

/** Returns the decoded value, or null if this is not a readable dev envelope. */
export function openDevEnvelope(value: string): unknown {
  if (!isDevEnvelope(value)) return null;
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(
        fromBase64(value.slice(PREFIX.length)),
      ),
    );
  } catch {
    return null;
  }
}

export type CollectionMetadata = { title: string; occasion: string };

export function openCollectionMetadata(
  value: string,
): CollectionMetadata | null {
  const decoded = openDevEnvelope(value);
  if (
    !decoded ||
    typeof decoded !== "object" ||
    typeof (decoded as CollectionMetadata).title !== "string" ||
    typeof (decoded as CollectionMetadata).occasion !== "string"
  )
    return null;
  const { title, occasion } = decoded as CollectionMetadata;
  return { title, occasion };
}
