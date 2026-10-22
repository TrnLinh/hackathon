import { Models, Tools, type TideCloak } from "@tidecloak/js";
import {
  bindingBytes,
  bindingTag,
  digest,
  parseBinding,
  type AuthorizationBinding,
  type SourceBinding,
  type EditionBinding,
} from "./binding";

export type ProofSdk = Pick<
  TideCloak,
  | "encrypt"
  | "decrypt"
  | "draftDecryption"
  | "commitDecryption"
  | "createTideRequest"
  | "requestTideOperatorApproval"
  | "executeSignRequest"
>;

// These guards help the workbench operator catch mistakes. The ORK contract
// must independently validate every field and signature, including revisions.
export class TidePolicyProof {
  constructor(
    private sdk: ProofSdk,
    private trust: { contractId: string; keyId: string },
  ) {
    if (!trust.contractId.trim() || !trust.keyId.trim())
      throw new Error("Pin a reviewed contract and vendor key first.");
  }

  private async policy(binding: AuthorizationBinding, bytes: Uint8Array) {
    if (!bytes.length) throw new Error("A signed Tide policy is required.");
    const policy = Models.Policy.from(bytes);
    if (
      policy.version !== "4" ||
      !policy.signature?.length ||
      policy.expiry === undefined ||
      policy.expiry <= BigInt(Math.floor(Date.now() / 1000))
    )
      throw new Error(
        "Use a signed, unexpired v4 policy with explicit expiry.",
      );
    if (
      policy.contractId !== this.trust.contractId ||
      policy.keyId !== this.trust.keyId
    )
      throw new Error(
        "Policy does not match the pinned contract and vendor key.",
      );
    if (
      policy.approvalType !== Models.ApprovalType.EXPLICIT ||
      policy.executionType !== Models.ExecutionType.PRIVATE
    )
      throw new Error(
        "Proof requires explicit contributor approvals and a private executor.",
      );
    if (
      policy.params.getParameter("bindingTag") !== (await bindingTag(binding))
    )
      throw new Error("Policy does not match the exact authorization binding.");
  }

  private async checkPlaintext(binding: SourceBinding, bytes: Uint8Array) {
    const expected =
      binding.use.kind === "processor"
        ? binding.use.inputDigest
        : binding.contentDigest;
    if ((await digest(bytes)) !== expected)
      throw new Error("Plaintext digest does not match the authorized input.");
  }

  async encrypt(
    input: SourceBinding,
    plaintext: Uint8Array,
    policy: Uint8Array,
  ) {
    const binding = parseBinding(input);
    if (binding.kind !== "source")
      throw new Error("Expected a source binding.");
    await this.policy(binding, policy);
    await this.checkPlaintext(binding, plaintext);
    return this.single(
      await this.sdk.encrypt(
        [{ data: plaintext, tags: [await bindingTag(binding)] }],
        policy,
      ),
    );
  }

  async decrypt(
    input: SourceBinding,
    ciphertext: Uint8Array,
    policy: Uint8Array,
  ) {
    const binding = parseBinding(input);
    if (binding.kind !== "source")
      throw new Error("Expected a source binding.");
    await this.policy(binding, policy);
    const bytes = this.single(
      await this.sdk.decrypt(
        [{ encrypted: ciphertext, tags: [await bindingTag(binding)] }],
        policy,
      ),
    );
    await this.checkPlaintext(binding, bytes);
    return bytes;
  }

  async draftRelease(
    input: SourceBinding,
    ciphertext: Uint8Array,
    policy: Uint8Array,
  ) {
    const binding = parseBinding(input);
    if (binding.kind !== "source")
      throw new Error("Expected a source binding.");
    await this.policy(binding, policy);
    const draft = await this.sdk.draftDecryption([
      { encrypted: ciphertext, tags: [await bindingTag(binding)] },
    ]);
    const request = Models.BaseTideRequest.decode(draft);
    // The SDK's drafted decryption path defaults to one week. Limit this
    // probe before initialization, so approvals cover the shorter expiry.
    request.setCustomExpiry(30);
    request.addPolicy(policy);
    return this.sdk.createTideRequest(request.encode());
  }

  async draftEdition(input: EditionBinding, policy: Uint8Array) {
    const binding = parseBinding(input);
    if (binding.kind !== "edition")
      throw new Error("Expected an edition binding.");
    await this.policy(binding, policy);
    // Candidate wire layout for a custom Chorus contract: field 0 is the
    // review label; field 1 is the exact canonical receipt payload. Live
    // deployment must prove the model and signature format before issuance.
    const draft = this.editionDraft(binding);
    const request = new Models.BaseTideRequest(
      "BasicCustom<ChorusEdition>",
      "BasicCustom<1>",
      "Policy:1",
      draft,
    );
    request.addPolicy(policy);
    return this.sdk.createTideRequest(request.encode());
  }

  async approve(
    input: AuthorizationBinding,
    requestBytes: Uint8Array,
    policy: Uint8Array,
  ) {
    await this.policy(parseBinding(input), policy);
    const before = this.checkRequestPolicy(requestBytes, policy);
    const results = await this.sdk.requestTideOperatorApproval([
      { id: before.getUniqueId(), request: requestBytes },
    ]);
    const result = results[0];
    if (
      results.length !== 1 ||
      result?.status !== "approved" ||
      result.id !== before.getUniqueId()
    )
      throw new Error("Contributor approval was not completed.");
    const after = Models.BaseTideRequest.decode(result.request);
    if (
      before.name !== after.name ||
      before.version !== after.version ||
      before.authFlow !== after.authFlow ||
      before.expiry !== after.expiry ||
      before.getUniqueId() !== after.getUniqueId() ||
      !this.equal(before.draft, after.draft) ||
      !this.equal(before.dyanmicData, after.dyanmicData) ||
      !this.equal(before.policy, after.policy)
    )
      throw new Error("Approval substituted the request.");
    return result.request;
  }

  async commitRelease(
    input: SourceBinding,
    request: Uint8Array,
    policy: Uint8Array,
  ) {
    const binding = parseBinding(input);
    if (binding.kind !== "source")
      throw new Error("Expected a source binding.");
    await this.policy(binding, policy);
    this.checkRequestPolicy(request, policy);
    const bytes = this.single(await this.sdk.commitDecryption(request, policy));
    await this.checkPlaintext(binding, bytes);
    return bytes;
  }

  async signEdition(
    input: EditionBinding,
    requestBytes: Uint8Array,
    policy: Uint8Array,
  ): Promise<Uint8Array> {
    const binding = parseBinding(input);
    if (binding.kind !== "edition")
      throw new Error("Expected an edition binding.");
    await this.policy(binding, policy);
    const request = this.checkRequestPolicy(requestBytes, policy);
    if (
      request.name !== "BasicCustom<ChorusEdition>" ||
      request.version !== "BasicCustom<1>" ||
      request.authFlow !== "Policy:1" ||
      !this.equal(request.draft, this.editionDraft(binding)) ||
      request.dyanmicData.length
    )
      throw new Error("Signing request does not bind the exact edition.");
    // The ORKs, not an application approval count, decide whether every named
    // contributor authorized this request. No local signing key exists here.
    return this.single(await this.sdk.executeSignRequest(requestBytes, true));
  }

  private checkRequestPolicy(bytes: Uint8Array, policy: Uint8Array) {
    const request = Models.BaseTideRequest.decode(bytes);
    if (
      !request.isInitialized() ||
      request.expiry <= Date.now() / 1000 ||
      !this.equal(request.policy, policy)
    )
      throw new Error(
        "Request is uninitialized, expired, or uses a different policy.",
      );
    return request;
  }

  private editionDraft(binding: EditionBinding) {
    const payload = bindingBytes(binding);
    return Tools.TideMemory.CreateFromArray([
      new TextEncoder().encode(
        JSON.stringify({
          humanReadableName:
            "Approve the exact Chorus edition and download audience",
          additionalInfo: JSON.parse(new TextDecoder().decode(payload)),
        }),
      ),
      payload,
    ]);
  }

  private equal(a: Uint8Array, b: Uint8Array) {
    return a.length === b.length && a.every((byte, index) => byte === b[index]);
  }

  private single(result: unknown): Uint8Array {
    if (
      !Array.isArray(result) ||
      result.length !== 1 ||
      !(result[0] instanceof Uint8Array) ||
      !result[0].length
    )
      throw new Error(
        "Unexpected Tide output; expected one nonempty byte array.",
      );
    return result[0];
  }
}
