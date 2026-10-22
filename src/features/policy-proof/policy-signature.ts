import { Models, Tools } from "@tidecloak/js";

// Integrity of policy bytes only: not current authorization, revocation, or an
// edition receipt. The caller supplies a separately pinned realm VVK key set.
export async function verifyPolicySignature(
  signedPolicy: Uint8Array,
  trust: { keyId: string; keys: JsonWebKey[] },
): Promise<boolean> {
  try {
    if (!signedPolicy.length || signedPolicy.length > 1024 * 1024) return false;
    const policy = Models.Policy.from(signedPolicy);
    if (
      !trust.keyId ||
      policy.keyId !== trust.keyId ||
      policy.signature?.length !== 64
    )
      return false;
    const outer = new Tools.TideMemory(signedPolicy.length);
    outer.set(signedPolicy);
    const body = new Uint8Array(outer.GetValue(0));
    const signature = new Uint8Array(policy.signature);
    for (const jwk of trust.keys) {
      if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.x) continue;
      try {
        const key = await crypto.subtle.importKey(
          "jwk",
          { kty: "OKP", crv: "Ed25519", x: jwk.x },
          "Ed25519",
          false,
          ["verify"],
        );
        if (await crypto.subtle.verify("Ed25519", key, signature, body))
          return true;
      } catch {
        // An unusable key must not hide a later usable pinned key.
      }
    }
    return false;
  } catch {
    return false;
  }
}
