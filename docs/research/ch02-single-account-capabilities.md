# CH-02: capabilities with one enrolled Tide identity

Checked 22 October 2026. This is source research and a probe recipe; no cryptographic operation, policy signing, role grant, contract deployment, or realm mutation was performed in this research task.

## Decision

Run the existing identity's **self-encryption round trip** with tag `message`, and independently verify a real network policy signature if an administrator chooses to sign a short-lived synthetic policy under the existing admin policy. These establish useful cryptographic primitives. Keep the Chorus source-release, processor-scope, exact-contributor quorum, edition receipt, withdrawal, and ordering acceptance gates open.

The parent task's current read-only realm inspection found `_tide_message.selfencrypt` and `_tide_message.selfdecrypt`, and no `_tide_encryptor` or `_tide_decryptor`. The first pair already authorizes the documented self path. The latter pair is mandatory for the built-in relationship contract's executor checks; `appUser` is not a supported substitute. No role change is necessary for the self probe. The relationship policy can be signed without granting those operation roles, but using it to encrypt/decrypt requires the missing governed grants. See the [official self-encryption API](https://docs.tide.org/Languages/JavaScript/tidecloak-js-tutorial), [relationship role matrix][relationship-matrix], and [relationship helper][relationship-helper].

## Sources and version boundary

Installed sources inspected: `@tidecloak/js` **0.14.41**, `heimdall-tide` **0.14.41**, and `@tideorg/js` **0.14.29**. The repository pins the first package; the other versions are installed/locked. Public registry metadata identified `@tideorg/mcp` **1.9.33** as latest during this check; its tarball was read in memory, without installation. SHA-256 of the tarball: `e747a54a2d8092b281f1d43f80acb0d2e5eb9983fc25986218a8f9ce67ab4f8a`. The [official Tide docs](https://docs.tide.org/ai-agent-pack) identify Raziel and link Tide's npm package and repository. The public repository's current `master` resolved to `b0e1e499f80ffefac01c50bc73aff882de4500ec`; the report primarily links **versioned npm source** so future edits do not silently change this evidence.

There are real documentation/source conflicts:

- Raziel's custom-contract canon still contains Policy v3 examples and an obsolete `Custom<...>` approval-card convention. The installed `Policy.latestVersion` is **`"4"`**. The installed `ModelRegistry` recognizes raw names/versions matching **`BasicCustom<...>`**, including the existing workbench's `BaseTideRequest("BasicCustom<ChorusEdition>", "BasicCustom<1>", ...)`. Do not change this to the canon's speculative double wrapping. Local rendering compatibility does not establish what the deployed enclave or ORKs run. [Pinned Policy source][policy-source], [pinned model registry][registry-source], [older canon guidance][custom-canon].
- The built-in relationship helper selects `Policy.latestVersion` dynamically, unlike the older prose examples. Its README says the helper itself was type-checked against 0.13.21 and **was not run**; its underlying calls and contract were measured on Tide's test stacks. Those measurements are Tide's evidence, not evidence for this realm or a v4 policy on its ORKs. [Helper][relationship-helper], [README][relationship-readme].
- Generic advice about arbitrary business roles does not override the relationship contract's fixed `_tide_encryptor` / `_tide_decryptor` realm-role checks. Use the contract-specific guide. [Role matrix][relationship-matrix], [custom canon's built-in table][custom-canon].

## 1. Custom Chorus Forseti contract: authoring is possible; deployment is gated

We can write C# implementing `Contract : IAccessPolicy`, inspect its wire parsing, and locally compile against the SDK shapes or Tide's compile harness. That is a useful preflight, not a network deployment. The harness documents that it checks shapes, a sandbox scan, and source hash; its stubs do not establish contract logic, real IL vetting, gas behavior, or deployed network compatibility. It requires .NET SDK 8+; this task did not install or run it. [Compile harness][compile-harness].

The current primary guidance explicitly reserves custom uploading to Tide's team and limits it to experimental/test-network use. This statement appears both in the [deployment canon][custom-canon] and the [endpoint canon][endpoint-canon]. Although installed `PolicySignRequest` has `addForsetiContractToUpload`, the presence of a transport builder does not make self-service contract deployment supported. Do not reconstruct an upload endpoint or interpret old end-to-end mainnet anecdotes in the same canon as current permission/support. [Pinned request builder][policy-sign-source].

**Concrete blocker:** obtain Tide's review/deployment decision, agreed target network, deployed source/hash, model compatibility, and verification configuration for Chorus. The current public materials establish the Tide-team deployment gate; they do not establish a self-service review SLA or a supported `testnetworkdeployment` API. No support message was sent. A custom Chorus contract is still required for the exact rules in [ADR 0001](../adr/0001-tide-policy-proof.md), unless the architecture is explicitly revised and reviewed.

## 2. Immediate no-grant self-encryption probe

The low-level API accepts an array of `{ data, tags }` and an optional signed policy; decrypt accepts `{ encrypted, tags }`. Omitting the policy selects the self path. The adapter checks `_tide_<tag>.selfencrypt` / `_tide_<tag>.selfdecrypt`; the enclave uses `encrypt` / `decrypt`, rather than `policy encrypt` / `policy decrypt`. The underlying flow constructs `TideSelfEncryption:1` and `SelfDecrypt:1` under `Doken:1`, binding encryption to the user's VUID. [Pinned adapter source][adapter-source], [request enclave][request-enclave], [self flow][self-flow].

Use the existing `useProofSdk()` instance, without creating another login session or an `IAMService` singleton:

```ts
import type { TideCloak } from "@tidecloak/js";

type SelfSdk = Pick<TideCloak, "encrypt" | "decrypt">;

function oneBytes(result: unknown): Uint8Array {
  if (
    !Array.isArray(result) ||
    result.length !== 1 ||
    !(result[0] instanceof Uint8Array) ||
    result[0].length === 0
  ) {
    throw new Error("Expected one nonempty Tide byte result");
  }
  return result[0];
}

export async function probeSelf(sdk: SelfSdk) {
  const original = new TextEncoder().encode("abc");
  const ciphertext = oneBytes(
    await sdk.encrypt([{ data: original, tags: ["message"] }]),
  );
  const plaintext = oneBytes(
    await sdk.decrypt([{ encrypted: ciphertext, tags: ["message"] }]),
  );
  if (
    plaintext.length !== original.length ||
    !plaintext.every((value, i) => value === original[i])
  ) {
    throw new Error("Self probe did not round-trip exact bytes");
  }
  return { ciphertext, plaintext };
}
```

This is an SDK/enclave/network round-trip control when actually run. It proves neither cross-user sharing nor contributor consent. The official guidance says another user with the same self-decrypt role cannot decrypt this user's data. Bytes remain private to the browser; publish only lengths/digests and sanitized outcomes. [Official self-encryption guide](https://docs.tide.org/Languages/JavaScript/tidecloak-js-tutorial), [Raziel self vs shared guidance][concepts].

A wrong-tag attempt on this path may be refused by the adapter's local role check before reaching ORKs. Label that result **local refusal**, not protected contract denial. Do not bypass this check merely to manufacture a stronger claim. One identity cannot prove another identity's denial. [Pinned adapter][adapter-source].

## 3. One-account network signing: sign a real relationship policy

This is the smallest supported signing workflow found that avoids deploying a custom contract or inventing a signature. The network signs a **policy grant** under the realm's already signed admin policy; it is not a signature over a PDF. With one enrolled admin, it succeeds only if the **actual** admin policy permits that admin's approval count. Do not reduce its threshold or substitute contributor approvals. [Relationship helper][relationship-helper], [role matrix][relationship-matrix].

Required preconditions:

1. A front-channel browser session with the existing low-level `TideCloak` instance, live doken/session, and working request/approval enclaves.
2. The signer holds `tide-realm-admin`, a **client role on `realm-management`**, and satisfies the real realm admin policy's threshold. One enrolled identity does not imply threshold one.
3. Obtain the real admin policy server-side through `GET /admin/realms/{realm}/iga/role-policies/name/tide-realm-admin` with the admin's token; take the response's **`policy` base64 field**, decode it in the browser, and pass those bytes. The list endpoint is an alternative only with exact name matching and exactly one match. Do not sign/serialize a replacement admin policy or fall back to the first row. [Endpoint canon][endpoint-canon], [helper lines 134–166][relationship-helper].
4. Pin the realm `vendorId` from the public adapter as the new policy's `keyId`; pin the independently trusted realm VVK Ed25519 public key from adapter `jwk.keys` for offline verification. Those keys are distinct from the OIDC JWKS used for login verification. [Attestation verifier][attestation-helper].
5. Confirm `RelationshipAttestation:1` exists on the target network. Tide documents it as source-verified on ORK main `c69fc4f6` dated 2026-10-16, not present everywhere. Network availability is unverified here. [Relationship README][relationship-readme].

The following uses only installed APIs. The **policy** is IMPLICIT/PRIVATE so its eventual encryption/decryption does not request contributor approvals. The **policy creation request** is governed by the real admin policy and includes the admin's enclave approval. These are distinct operations. This example uses the SDK's 30-second request default, chosen before initialization, and an explicitly supplied short-lived policy expiry. If approval times out, create a fresh request instead of extending an initialized one. Tide's reference helper uses a one-week signing-request expiry; adopting that duration is not required to follow its API ordering. [Policy source][policy-source], [BaseTideRequest][request-source], [helper][relationship-helper].

```ts
import { Models, type TideCloak } from "@tidecloak/js";
import { PolicySignRequest } from "heimdall-tide";

type RelationshipSdk = Pick<
  TideCloak,
  | "createTideRequest"
  | "requestTideOperatorApproval"
  | "executeSignRequest"
  | "encrypt"
  | "decrypt"
>;

export async function signSelfRelationshipPolicy(
  sdk: RelationshipSdk,
  input: {
    vendorId: string;
    tideUserKey: string; // current grantee's doken tideuserkey, verbatim
    recordId: string; // fixed synthetic record id
    expiry: number; // Unix seconds; a reviewed short lifetime
    adminPolicy: Uint8Array; // real signed admin policy from the endpoint
    access: "read" | "read-write";
  },
) {
  if (
    !input.vendorId ||
    !input.tideUserKey ||
    !input.recordId ||
    !Number.isSafeInteger(input.expiry) ||
    input.expiry <= Math.floor(Date.now() / 1000)
  ) {
    throw new Error("Missing identity/configuration or invalid policy expiry");
  }
  const admin = Models.Policy.from(input.adminPolicy);
  if (!admin.signature?.length || admin.keyId !== input.vendorId) {
    throw new Error("Real signed admin policy for the pinned realm required");
  }
  // These are preflight checks. ORKs verify the actual signature/quorum.
  const roles =
    input.access === "read"
      ? ["_tide_decryptor"]
      : ["_tide_encryptor", "_tide_decryptor"];
  const policy = new Models.Policy({
    version: Models.Policy.latestVersion,
    contractId: "RelationshipAttestation:1",
    modelId: ["PolicyEnabledEncryption:1", "PolicyEnabledDecryption:1"],
    keyId: input.vendorId,
    approvalType: Models.ApprovalType.IMPLICIT,
    executionType: Models.ExecutionType.PRIVATE,
    params: new Map<string, string>([
      ["subjectType", "User"],
      ["subjectId", input.tideUserKey],
      ["assignmentId", input.recordId],
      ["roles", JSON.stringify(roles)],
    ]),
    expiry: input.expiry,
  });
  const request = PolicySignRequest.New(policy);
  request.setCustomExpiry(30); // before initialization
  const initialized = await sdk.createTideRequest(request.encode());
  const before = Models.BaseTideRequest.decode(initialized);
  const id = before.getUniqueId();
  const approvals = await sdk.requestTideOperatorApproval([
    { id, request: initialized },
  ]);
  if (
    approvals.length !== 1 ||
    approvals[0].id !== id ||
    approvals[0].status !== "approved"
  ) {
    throw new Error("Administrator approval was not completed");
  }
  // Use the returned request: it contains the actual cryptographic approval.
  const approved = Models.BaseTideRequest.decode(approvals[0].request);
  if (
    approved.getUniqueId() !== id ||
    approved.expiry !== before.expiry ||
    approved.name !== before.name ||
    approved.version !== before.version ||
    approved.authFlow !== before.authFlow ||
    approved.draft.length !== before.draft.length ||
    !approved.draft.every((v, i) => v === before.draft[i])
  ) {
    throw new Error("Approval changed the initialized policy request");
  }
  approved.addPolicy(input.adminPolicy); // reference workflow attaches here
  const signatures = await sdk.executeSignRequest(approved.encode(), true);
  if (
    signatures.length !== 1 ||
    !(signatures[0] instanceof Uint8Array) ||
    signatures[0].length !== 64
  ) {
    throw new Error("Expected one 64-byte policy signature");
  }
  policy.signature = signatures[0];
  return policy.toBytes(); // signed policy, NOT the encoded request
}
```

`PolicySignRequest` is exported by **`heimdall-tide`**. It appears in low-level `lib/tidecloak` declarations but is not a root export of `@tidecloak/js`'s installed `src/index`; import it as shown. `Models` and `Tools` are root exports. The existing auth provider creates its own low-level instance; reuse that through `useProofSdk()` rather than the official template's private `IAMService._tc` access. [Pinned root exports][root-exports], [request builder][policy-sign-source], [local provider](../../src/features/auth/auth-provider.tsx), [local SDK type](../../src/features/policy-proof/tide.ts).

### Identity names must stay distinct

| Value                       | Meaning and use                                                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| issuer-qualified OIDC `sub` | Chorus database/login identity; keep for application linkage                                                                       |
| doken `tideuserkey`         | **Relationship `User` subjectId**, copied verbatim, with no decoding or normalization                                              |
| doken `vuid`                | ORK contract actor identity returned by `DokenDto.UserId`; a custom exact-actor contract must compare against this, not OIDC `sub` |
| public adapter `vendorId`   | realm signing key identifier; new policy's `keyId`                                                                                 |

For this one-account recipe, the signer and grantee are the same enrolled person; read their current doken's `tideuserkey`. A grantee's key is normally different from an admin's key. The built-in model uses the key, not the VUID; future Chorus bindings need a reviewed mapping from application subjects to network identities. The current `ProofSdk` type omits `dokenParsed`; a narrow read-only accessor or a `Pick<TideCloak, "dokenParsed">` seam is enough. Do not publish the doken or full identity claims. [Relationship helper][relationship-helper], [pinned Doken model][doken-source], [custom identity canon][custom-canon].

### Exact policy signature and offline verification

The signature returned by `executeSignRequest` is an array entry containing raw **64-byte Ed25519 `R || S`** (32 bytes each). The signing flow aggregates threshold contributions; `waitForAll=true` requests all-ORK participation rather than changing the administrator approval threshold. It does not create extra human identities or votes. [Pinned threshold flow][signing-flow].

For a Policy signature, `Policy.toBytes()` produces TideMemory **`[dataToVerify, signature]`**. The signed body is the **inner `dataToVerify` bytes**, not the whole signed envelope, `request.encode()`, a JSON object, or the Chorus binding tag. Pinned v4 `dataToVerify` fields are version, contract ID, nested model IDs, key ID, approval type, execution type, serialized params, and optional 8-byte little-endian policy expiry. The official attestation template independently builds this body and verifies it with WebCrypto Ed25519. [Pinned policy serialization][policy-source], [official byte builder/verifier][attestation-helper].

```ts
import { Models, Tools } from "@tidecloak/js";

export async function verifyPolicySignature(
  signedPolicy: Uint8Array,
  trustedRealmKeys: JsonWebKey[], // independently pinned adapter.jwk.keys
): Promise<boolean> {
  try {
    const parsed = Models.Policy.from(signedPolicy);
    if (!parsed.signature || parsed.signature.length !== 64) return false;
    const outer = new Tools.TideMemory(signedPolicy.length);
    outer.set(signedPolicy);
    // Retain the original wire body; do not JSON-reserialize signed data.
    const body = new Uint8Array(outer.GetValue(0));
    const signature = new Uint8Array(parsed.signature);
    for (const jwk of trustedRealmKeys) {
      if (jwk.kty !== "OKP" || jwk.crv !== "Ed25519" || !jwk.x) continue;
      const key = await crypto.subtle.importKey(
        "jwk",
        { kty: "OKP", crv: "Ed25519", x: jwk.x },
        { name: "Ed25519" },
        false,
        ["verify"],
      );
      if (await crypto.subtle.verify("Ed25519", key, signature, body)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
```

Run a valid control, then change one body byte and require verification failure; also require a changed signature and an independently generated wrong public key to fail. Verify the policy shape, trusted key ID, exact subject/record/access/expiry separately from its cryptographic signature. Offline verification authenticates a grant's bytes; it does not prove that the grant is still usable on ORKs, that an administrator cannot grant themselves access, or that Chorus contributor consent exists. The report's verifier is a source-derived candidate until applied to an actual returned signature on this realm. [Official verifier][attestation-helper], [relationship role matrix][relationship-matrix].

### Applying the policy after required realm grants exist

For a read-write policy, this is the supported policy path:

```ts
const [ciphertext] = await sdk.encrypt(
  [{ data: new TextEncoder().encode("abc"), tags: [recordId] }],
  signedRelationshipPolicy,
);
if (!(ciphertext instanceof Uint8Array))
  throw new Error("Unexpected ciphertext");
const [plaintext] = await sdk.decrypt(
  [{ encrypted: ciphertext, tags: [recordId] }],
  signedRelationshipPolicy,
);
if (
  !(plaintext instanceof Uint8Array) ||
  new TextDecoder().decode(plaintext) !== "abc"
) {
  throw new Error("Relationship probe did not round-trip");
}
```

The contract requires PRIVATE execution and accepts only `PolicyEnabledEncryption:1` / `PolicyEnabledDecryption:1`. Every item must have exactly the assignment tag; the signed policy's JSON-string `roles` must permit the operation; the executor must hold the corresponding fixed realm operation role and match the subject. `Group` requires a claim named exactly `groups`, with exact subject matching (usually full path); `Role` can name a realm role or a client role using optional `clientId`. These subject forms still require the fixed operation realm role. [Custom canon built-in table][custom-canon], [helper][relationship-helper], [role matrix][relationship-matrix].

With the required roles, one account can test: authorized round trip; a different tag denied; an extra tag denied; a separately admin-signed read-only policy denied on encryption. Require ORK cause/contract denial and successful controls before/after; threshold failure without a cause can also be an outage. Do not treat an adapter refusal or expiry as contract evidence. Another-user and group-nonmember denials need distinct enrolled identities and stay deferred. [Reference checks][relationship-readme].

Without `_tide_encryptor` / `_tide_decryptor`, a failed relationship round trip is a missing-precondition result. Substituting `appUser`, using empty policy bytes, or attaching a local fake signature would not make this a valid test. The model does not support arbitrary configured operation-role names. [Relationship helper][relationship-helper], [role matrix][relationship-matrix].

## 4. Arbitrary edition signing and model boundaries

The same low-level `createTideRequest` → returned approval bytes → `executeSignRequest` seam exists for custom requests. Installed local rendering supports the workbench's `BasicCustom<ChorusEdition>` name and JSON display metadata in draft field zero. That establishes request/display construction only. No reviewed/deployed Chorus contract, signed matching policy, independently specified **final signed message**, or receipt verifier was found in the project or installed client sources. The client signing aggregator returns signatures but does not implement the ORK's `BasicCustom` model message-selection logic. Consequently this research cannot authoritatively claim that the signature covers draft slot 1 alone, the whole TideMemory draft, its hash, or a particular framing. [Pinned registry][registry-source], [signing aggregator][signing-flow], [existing adapter](../../src/features/policy-proof/tide.ts).

`BaseTideRequest.dataToApprove()` concerns **approval** signatures: it constructs the domain-framed `PolicyAuthorizedTideRequest` v1 message containing creation time, expiry, model ID, and SHA-512 draft hash, then appends the creation signature. This is not a definition of the final custom-model signature payload. Its unique ID is derived from the creation signature. Do not conflate these with a public final-receipt verifier. [BaseTideRequest][request-source], [signature framing][signature-format].

The built-in relationship model only permits encryption and decryption. Its policy-signing workflow demonstrates real threshold Ed25519 policy signing, but does not turn it into an edition-signing contract or an exact two-contributor consent scheme. The generic threshold-role contracts check role-qualified approvers; that does not establish Chorus's named contributor set, data binding, or private executor requirements. [Built-in contract table][custom-canon], [relationship role matrix][relationship-matrix].

## 5. Revocation, revisions, and ordering remain an external design gate

No authoritative per-resource revision counter, compare-and-release transaction, network ordering receipt, or atomic withdrawal/release API was found in the inspected public SDK clients/models or canonical endpoint list. This is a bounded negative finding, not proof that Tide has no internal primitive. The sandbox blocks network and file I/O, so a contract cannot simply fetch Convex's latest revision from an arbitrary HTTP endpoint. [Endpoint canon][endpoint-canon], [sandbox limits][custom-canon].

There are narrower mechanisms, none sufficient to close Chorus's current requirement:

| Mechanism found                                                | Supported meaning                                                                   | Missing guarantee                                                                               |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Policy expiry                                                  | Signed lifetime; expiry is part of v4 policy bytes                                  | No early per-resource withdrawal or race ordering                                               |
| Role/group removal                                             | Changes what a newly issued/refreshed credential carries                            | Old session/token evidence and an in-flight window need measurement                             |
| Doken authorizer blocklist                                     | Raziel names internal `RevokedAuthorizerService`, says no explicit revoke-doken API | No documented application-facing resource revision/order primitive                              |
| Revoke-authorizing-policy flag mentioned by the model renderer | A comment recognizes an ORK flag used in admin-threshold policy re-signing          | No supported general resource-revocation API, ordering semantics, or public builder established |
| Deleting a stored policy                                       | Stops future application distribution                                               | A copied signed policy remains usable until some independent protected condition denies it      |

Sources: [Policy source][policy-source], [doken concepts][concepts], [renderer comment][registry-source], [relationship ending guidance][relationship-scenario]. Raziel explicitly says a `User` grant has no instant, certain per-record revocation; its suggested group removal takes effect when the credential changes, and that timing is labeled inferred. Its separate attestation template says epochs and signed withdrawals still need application logic to know which came last. [Relationship scenario][relationship-scenario], [attestation revocation guidance][attestation-readme].

Do not interpret `BaseTideRequest.removeApproval(vuid)` as revocation. It edits one request's serialized approval list locally and is not an authoritative withdrawal of previously issued requests, policies, or plaintext. [Pinned request implementation][request-source].

The authoritative design question for Tide remains: what ORK-enforced primitive establishes a per-resource current permission revision and one inspectable order between withdrawal and protected release/dispatch/signing, including previously captured signed requests and policies? Record policy, request, doken, propagation, and in-flight validity windows separately. Until this is answered and tested, ADR 0001's withdrawal gate remains open.

## 6. Recommended seams and evidence labels

1. Add a clearly labeled **single-account primitive** area to the development workbench. Use existing `useProofSdk()` for the no-policy `message` self round trip; it needs no `TidePolicyProof` instance or Chorus policy fixture.
2. Add policy-signature verification against an independently pinned realm key, initially for the existing real admin policy (read-only), then for an optionally approved short-lived synthetic relationship policy. This avoids granting new encryption roles just to prove signature verification.
3. Keep the `TidePolicyProof.policy()` contract/tag/EXPLICIT guards intact. Relationship policies are IMPLICIT and have different semantics. Put the primitive helper beside `tide.ts`; do not make the Chorus adapter accept a weaker policy to reuse its controls.
4. Stage the relationship round trip only after the fixed realm roles, actual network availability, and admin policy quorum are established. Keep an explicit unsupported/missing-precondition result otherwise.
5. Record success as **self round trip**, **realm policy signature verified**, or **relationship contract primitive**. Keep acceptance for exact contributor consent, unrelated-user denial, administrator separation, processors, final PDF/manifest receipts, and authoritative withdrawal deferred until each is observed.

Local seams: [proof page](../../src/features/policy-proof/proof-page.tsx), [SDK Pick and Chorus adapter](../../src/features/policy-proof/tide.ts), [auth provider and existing instance](../../src/features/auth/auth-provider.tsx). No runtime code, realm, callbacks, or authentication documentation was edited by this research task.

Verification of this note: all four TypeScript blocks type-checked with the installed TypeScript and SDK declarations through an in-memory compiler host, with zero diagnostics. The final application fragment supplied declarations for its existing `sdk`, `recordId`, and `signedRelationshipPolicy` context. No source files were emitted. Selected versioned source links returned HTTP 200. This establishes API/type compatibility, not live network behavior.

[custom-canon]: https://unpkg.com/@tideorg/mcp@1.9.33/canon/custom-contracts.md
[compile-harness]: https://unpkg.com/@tideorg/mcp@1.9.33/templates/forseti-compile-harness/README.md
[endpoint-canon]: https://unpkg.com/@tideorg/mcp@1.9.33/canon/tidecloak-endpoints.md
[concepts]: https://unpkg.com/@tideorg/mcp@1.9.33/canon/concepts.md
[relationship-helper]: https://unpkg.com/@tideorg/mcp@1.9.33/templates/relationship-attestation/relationship.ts
[relationship-readme]: https://unpkg.com/@tideorg/mcp@1.9.33/templates/relationship-attestation/README.md
[relationship-matrix]: https://unpkg.com/@tideorg/mcp@1.9.33/reference-apps/relationship-attestation/role-policy-matrix.md
[relationship-scenario]: https://unpkg.com/@tideorg/mcp@1.9.33/reference-apps/relationship-attestation/scenario.md
[attestation-helper]: https://unpkg.com/@tideorg/mcp@1.9.33/templates/attestation/attestation.ts
[attestation-readme]: https://unpkg.com/@tideorg/mcp@1.9.33/templates/attestation/README.md
[policy-source]: https://unpkg.com/@tideorg/js@0.14.29/dist/Models/Policy.js
[registry-source]: https://unpkg.com/@tideorg/js@0.14.29/dist/Models/ModelRegistry.js
[request-source]: https://unpkg.com/@tideorg/js@0.14.29/dist/Models/BaseTideRequest.js
[doken-source]: https://unpkg.com/@tideorg/js@0.14.29/dist/Models/Doken.js
[signature-format]: https://unpkg.com/@tideorg/js@0.14.29/dist/Cryptide/Signing/TideSignature.js
[signing-flow]: https://unpkg.com/@tideorg/js@0.14.29/dist/Flow/SigningFlows/dVVKSigningFlow.js
[self-flow]: https://unpkg.com/@tideorg/js@0.14.29/dist/Flow/EncryptionFlows/AuthorizedEncryptionFlow.js
[adapter-source]: https://unpkg.com/@tidecloak/js@0.14.41/dist/esm/lib/tidecloak.js
[root-exports]: https://unpkg.com/@tidecloak/js@0.14.41/dist/types/src/index.d.ts
[request-enclave]: https://unpkg.com/heimdall-tide@0.14.41/src/enclaves/RequestEnclave.ts
[policy-sign-source]: https://unpkg.com/heimdall-tide@0.14.41/src/models/PolicySignRequest.ts
