# CH-02: Tide policy proof boundary

Date: 22 October 2026. Status: **proposed integration; live release gate open**.

Issue: [CH-02 #3](https://github.com/TrnLinh/hackathon/issues/3). Parent implementation: `feat/ch-01-tidecloak-auth` at `bd40721`.

## Decision and current evidence

Use the existing browser TideCloak instance for policy-governed operations. Do not introduce a server decryption key, an application signer, or a database approval flag that substitutes for contributor signatures. The new development-only `/app/policy-proof` workbench invokes the installed SDK; it stores no requests, policy bytes or plaintext in Convex, local storage or application logs. Private binary downloads are explicit operator actions.

No realm has been enrolled for this task. The user explicitly deferred enrollment and live checks. Docker's daemon was unavailable and the local realm discovery endpoint was unreachable during inspection. No cryptographic acceptance criterion is claimed complete. The local tests substitute the SDK boundary, use deliberately invalid synthetic signatures, and establish only request construction, binding and client failure handling.

The deployed Chorus Forseti contract is still missing. This change defines its input commitment and an SDK probe; it does **not** implement, compile, distribute or verify that contract. Its required invariants are below. Neither the workbench nor the SHA-256 tag provides those invariants against a compromised application. Downstream protected-release implementation remains gated on real-network evidence.

## Inspected versions and APIs

| Component                                                    | Installed/pinned version           | Evidence                                                                                  |
| ------------------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `@tidecloak/js`                                              | 0.14.41                            | Existing exact direct dependency; public low-level SDK types and implementation inspected |
| `heimdall-tide`                                              | 0.14.41                            | Existing lockfile; request/approval enclave implementation inspected                      |
| `@tideorg/js`                                                | 0.14.29                            | Existing lockfile; actual Policy v4, BaseTideRequest and TideMemory round trips exercised |
| TideCloak dev image                                          | Digest in `compose.tidecloak.yaml` | Inherited from CH-01; not booted or validated here                                        |
| Chorus contract, deployed model and receipt verification key | **Not available**                  | Must be recorded after deployment and live proof                                          |

Low-level `TideCloak.encrypt(data, signedPolicy)` and `decrypt(data, signedPolicy)` forward the policy to the request enclave. Omitting policy bytes chooses the self-encryption path, which does not establish cross-user sharing. The adapter requires signed v4 policy bytes with expiry, an independently pinned contract/key ID, explicit approvals, a private executor and the exact `bindingTag` parameter. Policy parsing and signature presence are local preflight checks; the ORKs must verify signature validity and enforce the actual contract.

`draftDecryption` → attach the signed policy → `createTideRequest` prepares the source-release probe. The initialized bytes are handed to each contributor's `requestTideOperatorApproval`. Pass the **returned** request bytes to the next contributor; never reconstruct approval arrays from application state. `commitDecryption(request, policy)` submits the collected evidence. The adapter checks that an approval response preserves the initialized request, policy, expiry, draft and dynamic data. It does not count local approvals as authorization.

For edition signing the proposed model ID is `BasicCustom<ChorusEdition>:BasicCustom<1>`, with `Policy:1`, explicit approvals and private execution. The draft is TideMemory with field 0 a human-readable label and field 1 the exact canonical edition binding. `createTideRequest` → contributor approvals → `executeSignRequest(request, true)` is wired. **Model compatibility, what exact message the returned signature signs, and offline verification remain unverified. A returned signature file is not an official Chorus receipt.** The default SDK request lifetime is approximately 30 seconds; obtain fresh requests when expired. Do not extend validity just to hide a slow proof flow.

The workbench does not provision or sign policies. Tide's policy-signing path is a separate governed operation, with administrator approval and contract distribution. Follow supported Tide guidance for that operation; do not pretend that serializing `Policy.toBytes()` produces a signed policy.

## Commitment format and required contract behavior

`bindingBytes` encodes UTF-8 JSON with protocol `chorus-policy-proof/v1` and a strictly parsed `binding`. The parser produces a fixed field order, sorts identity sets using JavaScript code-unit order, rejects duplicates/unknown fields, and requires lowercase SHA-256 digests. Source dependency entries sort by their canonical JSON representation. Other implementations must reproduce these exact bytes; this is not a general JSON canonicalization standard. `bindingTag` is `chorus-proof-v1:` followed by the SHA-256 hex digest of those bytes.

A source binding includes collection, resource, immutable version, content digest, authoritative permission revision, every required approver, named recipient, review audience, and purpose. A processor binding additionally names transcription/visual-analysis/design role, exact input digest and derivative type, transformation version, and retention disclosure. A team-cloud processor remains an explicit plaintext recipient. Manual bindings cannot stand in for processor bindings. Source and derivative digests are distinct: processor encryption/decryption checks the input derivative digest.

An edition binding includes collection/candidate ID, exact PDF digest, canonical manifest digest, every final approver, issuance recipient, download audience and source-version/revision dependencies. The manifest must retain the complete source/processor lineage, including sources used only for style. The commitment does not calculate that dependency closure or choose approvers; those remain application/contract integration obligations.

Before trusting a deployed contract, prove on ORKs that it:

1. Restricts review to the assigned resource and named reviewer; neither unrelated users nor administrators receive a blanket decrypt capability.
2. Validates the content/version and request commitment, required identity set, executor/recipient, audience and exact manual/processor scope. Counts each contributor once and verifies cryptographic evidence from every named contributor. Administrator roles cannot satisfy contributor consent.
3. Checks ciphertext/resource binding at decryption, including direct calls bypassing this adapter. A client-supplied tag without protected binding is insufficient.
4. Distinguishes review, composition release, processor dispatch and edition signing. Changed recipient, purpose, derivative, transformation or retention needs a new exact permission.
5. Enforces current revision and operation ordering through the authoritative mechanism below, rather than trusting a mutable Convex flag or a caller-supplied revision.
6. Binds signing to the exact frozen edition and final approver set, then produces a signature verifiable with independently trusted public configuration.

The generic role-threshold contract is insufficient by itself: a count of role holders does not establish the exact contributor set, resource binding, or named executor. A custom reviewed contract or an explicitly reviewed envelope design is required.

## Withdrawal and race ordering: unresolved design gate

`permissionRevision` is a commitment field, **not an authoritative revision store**. Neither this implementation nor the inspected SDK establishes an atomic per-resource revision compare-and-release operation inside Tide. A Convex transaction cannot make an ORK operation atomic with a database write. The sandbox contract is not assumed to call a network revision service.

Do not claim immediate withdrawal from role removal, a renewed doken, an application flag, or the expiry of a locally cached object. Old signed policies, approval requests and session-bound authorization may have a remaining validity window. Establish the actual revocation mechanism and maximum residual window with Tide before accepting FR-13. Measure policy expiry, request expiry, doken lifetime, and propagation separately; none is presumed to equal another. If supported primitives cannot satisfy the required ordering, explicitly revise and review the SRD/architecture before downstream implementation. The requirements remain unchanged for now because support has not been established either way.

Race evidence must use one authoritative order: withdrawal accepted first denies later protected release/dispatch/signing; release accepted first remains a historical release. Concurrent attempts must produce an inspectable ordering reference, reject stale revisions and explain any in-flight validity window. Successfully released plaintext and downloaded PDFs cannot be recalled.

## Reproducible real-network checks (deferred)

1. Complete [CH-01 enrollment and governance setup](../authentication.md). Enroll Alice, Bob, editor, an unrelated user, named processors and at least three distinct administrators. Record stable issuer-qualified subjects, vendor key ID, deployed contract source/hash, signed policy/model versions, actual policy/request/doken expiries and actual quorum privately. Do not use display names as identities.
2. Run `npm ci` and `npm run dev:all`. With the existing CH-01 public adapter configuration, open `http://localhost:3000/app/policy-proof` in separate browser profiles. The page is absent as a working tool in production mode, requires sign-in and backend identity confirmation, and initially computes only a local commitment. The public application remains usable without a realm.
3. In the binding JSON replace every synthetic subject. Keep the plaintext `abc` and its supplied SHA-256 digest. Compute the commitment locally; have the reviewed contract and its real signed v4 policy bind the exact tag. Enter the independently reviewed contract ID and vendor key ID, then select the binary signed policy. Policy creation is a prerequisite, not performed by this workbench.
4. Encrypt `abc`; save only the ciphertext. For review use a separately scoped assigned-review policy/fixture. Inspect as Alice; use another resource and unrelated identity to show actual denial. For composition, draft a release using the two-contributor policy. Save the initialized binary privately, approve as Alice, and try committing as editor. It must fail. Hand the returned binary to Bob for approval; commit the returned binary as editor and compare the output digest with the known `abc` digest. Approval files can contain dokens; use private local handoff and delete them after the test. The ignored `.policy-proof/` folder is available for temporary files.
5. Exercise AT-04 through direct SDK calls. The workbench's **Raw SDK decryption** skips adapter policy guards and passes the chosen binding tag, ciphertext and policy directly to Tide. Try old evidence, altered version, wrong recipient/audience, duplicate actors and a changed database APPROVED flag. An error alone is inconclusive: require a successful authorized control before and after each denial, independently establish the protected denial reason, and keep raw diagnostics private. A UI preflight refusal, expired request or outage does not satisfy AT-04. If deeper direct request manipulation is needed, invoke the installed SDK from a private browser probe against the same fixture.
6. Provision separate named transcription, visual-analysis and design policies. Prove manual permission fails at the protected operation for every processor. Then prove exact processor approval succeeds; change recipient, purpose, derivative type/input digest, transformation version or retention and show fresh approval is needed. Repeat with derivatives rather than only source bytes.
7. Establish the authoritative withdrawal mechanism, then run the ordering/race checks above, including captured old requests and policies. Record the last possible successful stale release and all validity-window limitations. This is not implemented by the workbench.
8. For signing, hash a synthetic frozen PDF and manifest, then use the example below as an edition binding. Initialize once and collect distinct final approvals for that exact request. One missing approval, an administrator-only vote, another PDF/manifest or a withdrawn source dependency must fail on ORKs. Both final approvals must yield a verifiable signature. Save the detached payload, signature and public trust configuration; document and execute the exact offline verifier. Altered PDF bytes and another candidate's signature must fail. Until that verifier is established, do not publish an official receipt.
9. As one administrator propose a reversible source-rights or policy change. Attempt the protected operation below actual governance quorum; it must remain denied. Supply the additional administrator approval, prove the governed change takes effect, and remove the temporary grant through governance. Contributor approval must still be independently required.

For every case retain only a sanitized record: UTC time, pinned versions/contract/policy digests, pseudonymous actor label, binding commitment, operation, expected outcome, observed protected outcome, control outcome, and authoritative revision/order reference where applicable. Keep requests, tokens, dokens, enrollment links and plaintext out of published evidence. A workbench success reports only returned byte count and digest; it never marks acceptance complete.

Example edition binding (replace digests, subjects and dependencies with the actual synthetic candidate):

```json
{
  "kind": "edition",
  "collectionId": "synthetic-collection",
  "candidateId": "synthetic-candidate-v1",
  "pdfDigest": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "manifestDigest": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "requiredApprovers": ["alice-subject", "bob-subject"],
  "recipient": "issuer-subject",
  "audience": ["alice-subject", "bob-subject"],
  "sourceRevisions": [
    {
      "resourceId": "synthetic-memory",
      "versionId": "v1",
      "permissionRevision": "r1"
    }
  ]
}
```

## Acceptance status

| CH-02 criterion                                                | Current result                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Assigned review; unrelated identity denied                     | Pending deployed contract and live realm                                             |
| One contributor denied; both exact approvals succeed           | SDK handoff wired; real ORK proof pending                                            |
| Tampering, stale evidence, recipient substitution denied       | Local binding/preflight tests only; direct protected tests pending                   |
| Withdrawal and race ordering                                   | Unresolved authoritative primitive; implementation and live proof pending            |
| Exact synthetic PDF/manifest signing by all final contributors | Candidate request wired; contract, signature format and offline verification pending |
| Integration record, supported APIs and reproducible checks     | This record; no working server/contract pairing claimed                              |
| Exact processor/derivative scope enforcement                   | Local scope commitments tested; actual protected enforcement pending                 |
| Sensitive change blocked below administrator quorum            | Pending enrolled administrators and protected-operation evidence                     |

## Sources inspected

- [Tide E2EE setup](https://docs.tide.org/Admin/e2ee): governed realm and encryption prerequisites.
- [Forseti engine](https://docs.tide.org/Core-Concepts/forseti-engine): contract stages and distributed signing architecture. Some documentation import examples differ from installed exports; this implementation uses the actual `@tidecloak/js` Models/Tools exports.
- [Tide policy v4 release notes](https://docs.tide.org/ReleaseNotes/Tidecloak-0.14.28): signed expiry and governed policy signing.
- [Tide's published operational canon, version 1.9.23](https://unpkg.com/@tideorg/mcp@1.9.23/canon/concepts.md): sharing distinctions, generic-contract limitations and policy-signing sequence. These are vendor guidance, not live Chorus evidence.
- Installed SDK declarations and implementations under `node_modules/@tidecloak/js`, `heimdall-tide` and `@tideorg/js`, resolved by the committed lockfile.
