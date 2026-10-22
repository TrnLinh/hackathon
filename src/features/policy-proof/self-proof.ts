import type { ProofSdk } from "./tide";
import { digest } from "./binding";

function oneBytes(result: unknown): Uint8Array {
  if (
    !Array.isArray(result) ||
    result.length !== 1 ||
    !(result[0] instanceof Uint8Array) ||
    result[0].length === 0
  )
    throw new Error("Unexpected Tide output");
  return result[0];
}

export async function probeSelfEncryption(
  sdk: Pick<ProofSdk, "encrypt" | "decrypt">,
) {
  const original = new TextEncoder().encode("abc");
  const ciphertext = oneBytes(
    await sdk.encrypt([{ data: original, tags: ["message"] }]),
  );
  const recovered = oneBytes(
    await sdk.decrypt([{ encrypted: ciphertext, tags: ["message"] }]),
  );
  if (
    recovered.length !== original.length ||
    !recovered.every((byte, index) => byte === original[index])
  )
    throw new Error(
      "Self-encryption round-trip did not recover the exact bytes",
    );
  return {
    ciphertextBytes: ciphertext.length,
    plaintextDigest: await digest(recovered),
  };
}
