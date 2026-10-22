import { describe, expect, it } from "vitest";
import type { ProofSdk } from "./tide";

function sdk(): Pick<ProofSdk, "encrypt" | "decrypt"> {
  return {
    async encrypt(input, ...policy) {
      expect(policy).toHaveLength(0);
      expect(input).toEqual([
        { data: new TextEncoder().encode("abc"), tags: ["message"] },
      ]);
      return [new Uint8Array([9, 8, 7, 6])];
    },
    async decrypt(input, ...policy) {
      expect(policy).toHaveLength(0);
      expect(input).toEqual([
        { encrypted: new Uint8Array([9, 8, 7, 6]), tags: ["message"] },
      ]);
      return [new TextEncoder().encode("abc")];
    },
  };
}

describe("single-account primitive probe (network SDK substituted)", () => {
  it("uses the existing message self roles and reports only result metadata", async () => {
    const { probeSelfEncryption } = await import("./self-proof");
    expect(await probeSelfEncryption(sdk())).toEqual({
      ciphertextBytes: 4,
      plaintextDigest:
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    });
  });

  it("rejects a different recovered plaintext", async () => {
    const client = sdk();
    client.decrypt = async () => [new TextEncoder().encode("abd")];
    const { probeSelfEncryption } = await import("./self-proof");
    await expect(probeSelfEncryption(client)).rejects.toThrow("round-trip");
  });

  it.each([
    { result: [] },
    { result: [new Uint8Array()] },
    { result: [new Uint8Array([1]), new Uint8Array([2])] },
  ])("rejects missing or ambiguous ciphertext: %j", async ({ result }) => {
    const client = sdk();
    client.encrypt = async () => result;
    const { probeSelfEncryption } = await import("./self-proof");
    await expect(probeSelfEncryption(client)).rejects.toThrow("Tide output");
  });
});
