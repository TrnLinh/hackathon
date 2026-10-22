import { readFile } from "node:fs/promises";
import { beforeAll, describe, expect, it } from "vitest";
import { Models, Tools } from "@tidecloak/js";

let policyBytes: Uint8Array;
let keys: JsonWebKey[];
const keyId = "synthetic-policy-key";

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
  ]);
  if (!("privateKey" in pair)) throw new Error("Expected an Ed25519 key pair");
  keys = [await crypto.subtle.exportKey("jwk", pair.publicKey)];
  const policy = new Models.Policy({
    version: "4",
    contractId: "RelationshipAttestation:1",
    modelId: ["PolicyEnabledEncryption:1", "PolicyEnabledDecryption:1"],
    keyId,
    approvalType: Models.ApprovalType.IMPLICIT,
    executionType: Models.ExecutionType.PRIVATE,
    params: new Map([["assignmentId", "synthetic-record"]]),
    expiry: 4_000_000_000,
  });
  const body = policy.dataToVerify;
  if (!body) throw new Error("Expected serialized policy body");
  policy.signature = new Uint8Array(
    await crypto.subtle.sign("Ed25519", pair.privateKey, new Uint8Array(body)),
  );
  policyBytes = policy.toBytes();
});

describe("offline Tide policy signature integrity", () => {
  it("verifies a real Ed25519 signature over the original policy wire body", async () => {
    const { verifyPolicySignature } =
      await import("../src/features/policy-proof/policy-signature");
    expect(await verifyPolicySignature(policyBytes, { keyId, keys })).toBe(
      true,
    );
  });

  it("rejects a structurally valid changed body", async () => {
    const outer = new Tools.TideMemory(policyBytes.length);
    outer.set(policyBytes);
    const body = new Uint8Array(outer.GetValue(0));
    body[body.length - 1] ^= 1;
    const changed = Tools.TideMemory.CreateFromArray([body, outer.GetValue(1)]);
    const { verifyPolicySignature } =
      await import("../src/features/policy-proof/policy-signature");
    expect(await verifyPolicySignature(changed, { keyId, keys })).toBe(false);
  });

  it("rejects a changed signature", async () => {
    const changed = Models.Policy.from(policyBytes);
    changed.signature![0] ^= 1;
    const { verifyPolicySignature } =
      await import("../src/features/policy-proof/policy-signature");
    expect(
      await verifyPolicySignature(changed.toBytes(), { keyId, keys }),
    ).toBe(false);
  });

  it("rejects a different trusted key or key identifier", async () => {
    const other = await crypto.subtle.generateKey("Ed25519", true, [
      "sign",
      "verify",
    ]);
    if (!("publicKey" in other)) throw new Error("Expected key pair");
    const { verifyPolicySignature } =
      await import("../src/features/policy-proof/policy-signature");
    expect(
      await verifyPolicySignature(policyBytes, {
        keyId,
        keys: [await crypto.subtle.exportKey("jwk", other.publicKey)],
      }),
    ).toBe(false);
    expect(
      await verifyPolicySignature(policyBytes, { keyId: "another-key", keys }),
    ).toBe(false);
    expect(
      await verifyPolicySignature(new Uint8Array([1, 2, 3]), { keyId, keys }),
    ).toBe(false);
  });

  it.skipIf(
    !process.env.CHORUS_LIVE_POLICY_PATH ||
      !process.env.CHORUS_LIVE_POLICY_TRUST_PATH,
  )(
    "verifies the locally captured real realm policy and rejects corruption",
    async () => {
      const bytes = new Uint8Array(
        await readFile(process.env.CHORUS_LIVE_POLICY_PATH!),
      );
      const trust = JSON.parse(
        await readFile(process.env.CHORUS_LIVE_POLICY_TRUST_PATH!, "utf8"),
      );
      const { verifyPolicySignature } =
        await import("../src/features/policy-proof/policy-signature");
      expect(await verifyPolicySignature(bytes, trust)).toBe(true);
      const damaged = new Uint8Array(bytes);
      damaged[damaged.length - 1] ^= 1;
      expect(await verifyPolicySignature(damaged, trust)).toBe(false);
    },
  );
});
