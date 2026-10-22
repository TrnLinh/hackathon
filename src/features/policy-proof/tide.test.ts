import { describe, expect, it, vi } from "vitest";
import { Models, Tools } from "@tidecloak/js";
import { TidePolicyProof, type ProofSdk } from "./tide";
import { bindingTag, digest, type SourceBinding } from "./binding";

const binding: SourceBinding = {
  kind: "source",
  collectionId: "collection",
  resourceId: "source",
  versionId: "v1",
  contentDigest: await digest(new TextEncoder().encode("synthetic memory")),
  permissionRevision: "r1",
  requiredApprovers: ["alice", "bob"],
  recipient: "editor",
  audience: ["alice", "bob", "editor"],
  use: { kind: "manual", purpose: "compose" },
};

async function policyBytes(change: Record<string, unknown> = {}) {
  const policy = new Models.Policy({
    version: "4",
    contractId: "reviewed-contract",
    modelId: ["PolicyEnabledEncryption:1", "PolicyEnabledDecryption:1"],
    keyId: "vendor-key",
    approvalType: Models.ApprovalType.EXPLICIT,
    executionType: Models.ExecutionType.PRIVATE,
    params: new Map([["bindingTag", await bindingTag(binding)]]),
    expiry: Math.floor(Date.now() / 1000) + 300,
    ...change,
  });
  // Deliberately NOT a Tide signature. Only the live ORKs can validate it.
  policy.signature = new Uint8Array(64).fill(1);
  return policy.toBytes();
}

function setup() {
  const sdk = {
    encrypt: vi.fn().mockResolvedValue([new Uint8Array([1, 2, 3])]),
    decrypt: vi
      .fn()
      .mockResolvedValue([new TextEncoder().encode("synthetic memory")]),
    draftDecryption: vi.fn(),
    commitDecryption: vi.fn(),
    createTideRequest: vi.fn(),
    requestTideOperatorApproval: vi.fn(),
    executeSignRequest: vi.fn(),
  } satisfies ProofSdk;
  return {
    sdk,
    proof: new TidePolicyProof(sdk, {
      contractId: "reviewed-contract",
      keyId: "vendor-key",
    }),
  };
}

describe("Tide policy proof boundary (SDK substituted; not live security evidence)", () => {
  it("encrypts exact synthetic bytes under a nonempty signed policy and scope commitment", async () => {
    const { sdk, proof } = setup();
    const policy = await policyBytes();
    expect(
      await proof.encrypt(
        binding,
        new TextEncoder().encode("synthetic memory"),
        policy,
      ),
    ).toEqual(new Uint8Array([1, 2, 3]));
    expect(sdk.encrypt).toHaveBeenCalledWith(
      [
        {
          data: new TextEncoder().encode("synthetic memory"),
          tags: [await bindingTag(binding)],
        },
      ],
      policy,
    );
    await expect(
      proof.encrypt(binding, new Uint8Array([9]), policy),
    ).rejects.toThrow("digest");
  });

  it("does not dispatch absent, stale, wrong-contract, public or substituted-scope policies", async () => {
    const { sdk, proof } = setup();
    const unsigned = Models.Policy.from(await policyBytes());
    unsigned.signature = undefined;
    const wrongScope = new Map([["bindingTag", "another-scope"]]);
    for (const policy of [
      new Uint8Array(),
      unsigned.toBytes(),
      await policyBytes({ expiry: 1 }),
      await policyBytes({ expiry: undefined }),
      await policyBytes({ contractId: "other-contract" }),
      await policyBytes({ keyId: "other-key" }),
      await policyBytes({ approvalType: Models.ApprovalType.IMPLICIT }),
      await policyBytes({ executionType: Models.ExecutionType.PUBLIC }),
      await policyBytes({ params: wrongScope }),
    ])
      await expect(
        proof.decrypt(binding, new Uint8Array([1]), policy),
      ).rejects.toThrow();
    expect(sdk.decrypt).not.toHaveBeenCalled();
  });

  it("propagates protected-operation denial and rejects missing or mismatched plaintext", async () => {
    const { sdk, proof } = setup();
    const policy = await policyBytes();
    sdk.decrypt.mockRejectedValueOnce(new Error("Tide denied release"));
    await expect(
      proof.decrypt(binding, new Uint8Array([1]), policy),
    ).rejects.toThrow("Tide denied release");
    sdk.decrypt.mockResolvedValueOnce([new Uint8Array([7])]);
    await expect(
      proof.decrypt(binding, new Uint8Array([1]), policy),
    ).rejects.toThrow("digest");
    sdk.decrypt.mockResolvedValueOnce([]);
    await expect(
      proof.decrypt(binding, new Uint8Array([1]), policy),
    ).rejects.toThrow("output");
    expect(await proof.decrypt(binding, new Uint8Array([1]), policy)).toEqual(
      new TextEncoder().encode("synthetic memory"),
    );
  });

  it("uses the exact derivative digest for processor operations", async () => {
    const { sdk, proof } = setup();
    const processor: SourceBinding = {
      ...binding,
      recipient: "transcriber",
      use: {
        kind: "processor",
        role: "transcription",
        purpose: "transcribe",
        derivativeType: "audio",
        inputDigest: await digest(new Uint8Array([42])),
        transformationVersion: "audio-v1",
        retention: "memory-only",
      },
    };
    const policy = Models.Policy.from(await policyBytes());
    policy.params.entries.set("bindingTag", await bindingTag(processor));
    await proof.encrypt(processor, new Uint8Array([42]), policy.toBytes());
    await expect(
      proof.encrypt(
        processor,
        new TextEncoder().encode("synthetic memory"),
        policy.toBytes(),
      ),
    ).rejects.toThrow("digest");
    expect(sdk.encrypt).toHaveBeenCalledTimes(1);
  });

  it("preserves an initialized request across contributor handoff and rejects substitution", async () => {
    const { sdk, proof } = setup();
    const request = new Models.BaseTideRequest(
      "PolicyEnabledDecryption",
      "1",
      "Policy:1",
      new Uint8Array([11]),
    );
    request.addPolicy(await policyBytes());
    request.addCreationSignature(new Uint8Array(8), new Uint8Array(64).fill(2));
    const approved = Models.BaseTideRequest.decode(request.encode());
    approved.addAuthorizer(
      Tools.TideMemory.CreateFromArray([
        new TextEncoder().encode("synthetic-doken"),
      ]),
    );
    sdk.requestTideOperatorApproval.mockResolvedValueOnce([
      {
        id: request.getUniqueId(),
        request: approved.encode(),
        status: "approved",
      },
    ]);
    const policy = request.policy;
    expect(await proof.approve(binding, request.encode(), policy)).toEqual(
      approved.encode(),
    );
    approved.draft = new Tools.TideMemory([99]);
    sdk.requestTideOperatorApproval.mockResolvedValueOnce([
      {
        id: request.getUniqueId(),
        request: approved.encode(),
        status: "approved",
      },
    ]);
    await expect(
      proof.approve(binding, request.encode(), policy),
    ).rejects.toThrow("substituted");
    for (const status of ["pending", "denied"]) {
      sdk.requestTideOperatorApproval.mockResolvedValueOnce([
        { id: request.getUniqueId(), request: request.encode(), status },
      ]);
      await expect(
        proof.approve(binding, request.encode(), policy),
      ).rejects.toThrow("not completed");
    }
  });

  it("requires the same current policy at release commit; an SDK denial cannot become a release", async () => {
    const { sdk, proof } = setup();
    const policy = await policyBytes();
    const request = new Models.BaseTideRequest(
      "PolicyEnabledDecryption",
      "1",
      "Policy:1",
    );
    request.addPolicy(policy);
    await expect(
      proof.commitRelease(binding, request.encode(), policy),
    ).rejects.toThrow("uninitialized");
    request.addCreationSignature(new Uint8Array(8), new Uint8Array(64).fill(2));
    sdk.commitDecryption.mockRejectedValueOnce(
      new Error("missing named approval"),
    );
    await expect(
      proof.commitRelease(binding, request.encode(), policy),
    ).rejects.toThrow("missing named approval");
    const other = await policyBytes({
      expiry: Math.floor(Date.now() / 1000) + 600,
    });
    await expect(
      proof.commitRelease(binding, request.encode(), other),
    ).rejects.toThrow("different policy");
    request.expiry = 1;
    await expect(
      proof.commitRelease(binding, request.encode(), policy),
    ).rejects.toThrow("expired");
    expect(sdk.commitDecryption).toHaveBeenCalledTimes(1);
  });

  it("drafts a release for exact ciphertext and scope, then initializes it with the signed policy", async () => {
    const { sdk, proof } = setup();
    const policy = await policyBytes();
    const draft = new Models.BaseTideRequest(
      "PolicyEnabledDecryption",
      "1",
      "Policy:1",
      new Uint8Array([11]),
    );
    draft.setCustomExpiry(604800);
    sdk.draftDecryption.mockResolvedValueOnce(draft.encode());
    sdk.createTideRequest.mockImplementationOnce(async (bytes) => {
      const request = Models.BaseTideRequest.decode(bytes);
      expect(request.policy).toEqual(policy);
      expect(request.expiry).toBeLessThanOrEqual(
        Math.floor(Date.now() / 1000) + 30,
      );
      request.addCreationSignature(
        new Uint8Array(8),
        new Uint8Array(64).fill(5),
      );
      return request.encode();
    });
    const initialized = await proof.draftRelease(
      binding,
      new Uint8Array([7, 8]),
      policy,
    );
    expect(Models.BaseTideRequest.decode(initialized).isInitialized()).toBe(
      true,
    );
    expect(sdk.draftDecryption).toHaveBeenCalledWith([
      { encrypted: new Uint8Array([7, 8]), tags: [await bindingTag(binding)] },
    ]);
  });

  it("carries the exact frozen edition through initialization, approval and distributed signing", async () => {
    const { sdk, proof } = setup();
    const edition = {
      kind: "edition" as const,
      collectionId: "collection",
      candidateId: "candidate",
      pdfDigest: "a".repeat(64),
      manifestDigest: "b".repeat(64),
      requiredApprovers: ["alice", "bob"],
      recipient: "issuer",
      audience: ["alice", "bob"],
      sourceRevisions: [
        { resourceId: "source", versionId: "v1", permissionRevision: "r1" },
      ],
    };
    const policy = Models.Policy.from(await policyBytes());
    policy.params.entries.set("bindingTag", await bindingTag(edition));
    sdk.createTideRequest.mockImplementation(async (bytes) => {
      const request = Models.BaseTideRequest.decode(bytes);
      request.addCreationSignature(
        new Uint8Array(8),
        new Uint8Array(64).fill(3),
      );
      return request.encode();
    });
    const request = await proof.draftEdition(edition, policy.toBytes());
    expect(
      Models.ModelRegistry.getHumanReadableModelBuilder(
        "edition-proof",
        request,
      ).getRequestDataJson(),
    ).toEqual({
      protocol: "chorus-policy-proof/v1",
      binding: expect.objectContaining({
        candidateId: "candidate",
        pdfDigest: edition.pdfDigest,
      }),
    });
    sdk.executeSignRequest.mockRejectedValueOnce(
      new Error("missing final approver"),
    );
    await expect(
      proof.signEdition(edition, request, policy.toBytes()),
    ).rejects.toThrow("missing final approver");
    sdk.executeSignRequest.mockResolvedValueOnce([new Uint8Array(64).fill(4)]);
    expect(
      await proof.signEdition(edition, request, policy.toBytes()),
    ).toHaveLength(64);
    const altered = Models.BaseTideRequest.decode(request);
    altered.draft = Tools.TideMemory.CreateFromArray([
      new Uint8Array(),
      new TextEncoder().encode("different PDF"),
    ]);
    await expect(
      proof.signEdition(edition, altered.encode(), policy.toBytes()),
    ).rejects.toThrow("exact edition");
    expect(sdk.executeSignRequest).toHaveBeenLastCalledWith(request, true);
  });
});
