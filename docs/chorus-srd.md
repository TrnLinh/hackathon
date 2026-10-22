# Chorus Software Requirements Document

Version 0.1 · 22 October 2026 · Hackathon MVP

Chorus shall let a small group create an approved, downloadable photozine from shared photos and stories. This SRD defines the required software behavior, trust boundaries, data model, and verification criteria. The [Product Specification](chorus-product-spec.md) defines the intended user experience.

Requirements marked MUST are necessary for the complete MVP. SHOULD requirements improve the experience and may be deferred with a documented reason. MAY requirements are optional. Numeric limits and performance targets below are proposed engineering defaults.

## Scope and assumptions

- The reference scenario has one collection, three authenticated contributors, six to twelve memories, and a six-page PDF.
- The client runs in a current desktop or mobile browser. The PDF can be read outside Chorus without authentication.
- The demo may use pre-enrolled Tide accounts. No email provider or public gallery is required.
- Supported upload formats are JPEG and PNG, with a maximum original size of 10 MiB per file and a maximum decoded size of 24 megapixels. A collection accepts at most twelve active memories in the MVP.
- A caption accepts up to 240 Unicode code points, a story up to 2,000, and a collection title up to 80. The interface reports limits before submission.
- At least three distinct administrative identities shall be configured, with the live governance policy verified to require more than one approval for the tested sensitive change. Two administrators alone must not be assumed to establish a two-person threshold.
- The application-specific Tide policies are required integrations, not existing Chorus features. Their feasibility shall be established before the rest of the application depends on them.

## Terminology

| Term                   | Meaning                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Memory                 | A photo, caption, optional story, attribution, and declared required approvers                                                |
| Memory version         | An immutable revision of that content and its declared participants                                                           |
| Composition permission | Approval to release a memory version to a named editor, review audience, and disclosed text processor for one collection      |
| Candidate              | A frozen PDF and manifest submitted for final review                                                                          |
| Edition                | A candidate with a valid official issuance authorization                                                                      |
| Source approvers       | The uploader plus the declared people involved in a memory                                                                    |
| Edition approvers      | The union of source approvers across every included memory, plus authors of any new attributed opening or closing text        |
| Receipt                | A verifiable authorization that binds an edition to its manifest, exact PDF digest, recipients, and completed final approvals |
| Protected release      | An authorized operation that makes encrypted source or preview content readable to a recipient                                |

## Actors and permissions

| Actor                        | Allowed behavior                                                                              | Restrictions                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Creator                      | Create a collection, invite members, select eligible material, edit layout, freeze candidates | Cannot approve for another person or override source access rules                              |
| Contributor                  | Submit and revise their material, review assigned sources, approve or decline candidates      | Membership alone does not permit reading all private sources                                   |
| Authorized download member   | Download an officially approved edition named in their grant                                  | Cannot use that grant for a different candidate                                                |
| Infrastructure administrator | Operate storage and services, propose governed permission changes                             | Administrative access alone does not authorize all source decryption or contributor signatures |
| Text processor               | Receive explicitly authorized text for one composition request                                | No photo access or standing permission to browse collections                                   |
| External recipient           | Read a PDF someone sends them                                                                 | No Chorus account is required and forwarding cannot be technically prevented                   |

User-facing contributor permissions and administrator governance shall remain distinct. A person may hold multiple roles, but their actions must use the appropriate authority.

## Functional requirements

### Identity and collection membership

| ID    | Priority | Requirement                                                                                                                                                                                                            |
| ----- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-01 | MUST     | Authenticate users through TideCloak and validate authorization on protected application requests. Use stable authenticated subject identifiers for permissions.                                                       |
| FR-02 | MUST     | Let an authenticated creator create a collection with a title and occasion.                                                                                                                                            |
| FR-03 | MUST     | Support a creator-controlled join or membership flow for authenticated contributors. A join URL alone shall not grant decryption rights.                                                                               |
| FR-04 | MUST     | Prevent members of another collection from reading its private metadata or retrieving its protected content. Removing a member shall stop new application-authorized access without claiming to erase previous copies. |

### Contributions and source review

| ID    | Priority | Requirement                                                                                                                                                                                                                                                                                         |
| ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-05 | MUST     | Accept a supported photo with a caption, optional story, attribution, and required participants. Include the uploader in the required approver set and reject an empty set or an unresolved required identity.                                                                                      |
| FR-06 | MUST     | Validate file signatures, decoded image dimensions, size, and text limits. Reject executable or unsupported content, including SVG uploads. Normalize orientation and remove EXIF metadata, including GPS, before encrypting the retained photo. Do not persist the unnormalized original remotely. |
| FR-07 | MUST     | Encrypt photo bytes, captions, stories, and sensitive source metadata before remote persistence. Use verified SDK behavior or a reviewed envelope-encryption design with policy-protected key release.                                                                                              |
| FR-08 | MUST     | Give an authenticated required approver limited access to the exact source they must review. This review grant shall not give unrelated members or administrators source access.                                                                                                                    |
| FR-09 | MUST     | Collect explicit composition decisions from every required approver, binding each decision to the immutable source version, collection, editor, named review audience, and disclosed processor scope. Pending or declined decisions shall block release to the composition recipient.               |
| FR-10 | MUST     | Enforce source release through the protected cryptographic operation. Changing a UI state or a database approval flag alone shall not authorize decryption. Replayed approvals for another version, recipient, or scope shall be rejected.                                                          |
| FR-11 | MUST     | Let contributors approve, decline, or request an edit without requiring a rejection explanation. Show a contribution as private, awaiting permission, available, or excluded as appropriate.                                                                                                        |
| FR-12 | MUST     | Create a new immutable memory version when protected content or its participant set changes. Prior permissions shall not authorize that new version. Membership changes shall not silently change its recorded audience.                                                                            |
| FR-13 | MUST     | Record withdrawal as a new decision event. Stop new releases and official issuance that depend on withdrawn permission, subject to the concurrency rule below. Preserve the history and identify previously issued editions as historical records.                                                  |

### Composition and optional AI assistance

| ID    | Priority | Requirement                                                                                                                                                                                                                                                                                                               |
| ----- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-14 | MUST     | Compose the PDF from sources for which the editor and candidate review audience have valid composition permissions. Excluded and pending sources shall not enter model inputs, rendered pages, or PDF resources.                                                                                                          |
| FR-15 | MUST     | Provide one fixed six-page A5 portrait template, including cover, opening note, photo spread, multiple perspectives, collage, and closing messages. Allow photo selection, ordering, and caption editing.                                                                                                                 |
| FR-16 | MUST     | Treat newly written or AI-edited captions and messages as content requiring final approval. If an edit changes the meaning or processing scope of a source contribution, create a revised source version and collect composition permission again.                                                                        |
| FR-17 | SHOULD   | Offer optional text assistance for headings, caption polishing, and grouping. Submit only authorized text to the disclosed processor; do not submit photo pixels. Retain source attribution for each suggestion and prohibit invented events or quotations in the generation instructions. Human review remains required. |
| FR-18 | MUST     | Allow the entire create, review, and export journey without AI. Processor failure shall leave a usable manual workflow and shall not trigger a silent fallback to another provider.                                                                                                                                       |

### Candidate review and official issuance

| ID    | Priority | Requirement                                                                                                                                                                                                                                                                                                                          |
| ----- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| FR-19 | MUST     | Freeze a candidate as an exact PDF byte sequence and immutable manifest. The manifest shall identify included source versions, template version, ordered content, required approvers, named download members, and distribution scope. Compute collision-resistant digests over the PDF bytes and a canonical manifest serialization. |
| FR-20 | MUST     | Provide the exact frozen PDF for private review to the named review audience already authorized by its source permissions. Bind each final approval to the candidate manifest digest and PDF digest. Reviewers shall acknowledge that the approved edition can be kept, printed, and forwarded outside Chorus.                       |
| FR-21 | MUST     | Require every edition approver's valid final approval before issuing the official receipt. Missing, declined, stale, withdrawn, substituted, or duplicated identities shall not satisfy the requirement. Administrative quorum shall not replace contributor approvals.                                                              |
| FR-22 | MUST     | Create a new candidate when any PDF byte, included memory version, approver set, download member, or distribution scope changes. Final approvals for the previous candidate shall not transfer.                                                                                                                                      |
| FR-23 | MUST     | Bind the official receipt to the exact candidate and download scope using a verifiable, policy-governed authorization. Direct API calls or database edits shall not produce a valid receipt without the required approvals.                                                                                                          |
| FR-24 | MUST     | Return the exact approved PDF without rendering it again after approval. The official download path shall verify the receipt, current application access, and content digest before returning the file.                                                                                                                              |
| FR-25 | MUST     | Embed all image and font resources needed to view the PDF offline. Include an edition identifier, provide a readable filename, and ensure captions are not clipped. Offer an optional detached receipt with a verification procedure.                                                                                                |
| FR-26 | MUST     | Provide an authenticated history of source decisions, candidate approvals, withdrawals, official issuance, and download authorization events. Do not expose private rejection explanations or unnecessary contributor identifiers in the exported PDF or public receipt.                                                             |

## Consent lifecycle and concurrency

A source starts as PRIVATE. Submitting its immutable version and use scope creates a composition permission request in PENDING state. All required approvals produce APPROVED permission. A decline produces DECLINED permission; changing a decision is recorded as another authenticated event. A content or scope change creates a new request rather than mutating the approved record.

A candidate starts as IN_REVIEW. It becomes READY when every required final decision is approved and every source dependency remains valid. An issuance transaction produces ISSUED status and a receipt. Declines or changes move it to CHANGES_REQUESTED or SUPERSEDED; those states cannot issue a receipt.

Authorization events shall have a defined ordering. Source release or edition issuance must check the latest committed permission revision and bind the result to that revision. If withdrawal commits first, the operation must fail; if an authorized release commits first, the withdrawal cannot recall that release. Requests with stale revisions must retry against current state. Recording an event only in an editable application table is not sufficient to enforce this rule against a compromised backend.

The implementation spike must establish how the Tide policy or another verified authoritative grant mechanism handles current permission revisions, revocation, expiry, and concurrent requests. If immediate revocation is unavailable, the implementation must explicitly document the supported validity window and revise this requirement before presenting it as achieved. Expiry alone is not equivalent to immediate withdrawal.

The creator may omit a blocked memory and freeze a new candidate from remaining approved material. No timeout, creator action, membership removal, or administrator vote may silently stand in for a missing contributor approval. Declared participants cannot be removed from an existing version in place.

## Architecture and data flow

### Client

The browser handles identity interaction, photo normalization, encryption, authorized decryption, layout, preview, and PDF rendering. Plaintext required for those actions exists in an authorized client session. Thumbnails and cached previews require the same access protection as their source; unavailable memories use placeholders. Revoke temporary object URLs and release buffers when no longer needed. Do not place source plaintext or tokens in analytics or application logs.

### Application API and storage

The API manages membership, opaque identifiers, encrypted payload locations, immutable version records, and orchestration. A relational database stores references and workflow projections. A private blob store holds encrypted assets and frozen PDF candidates. Approval eligibility is derived from verifiable authorization, not trusted merely because the database says APPROVED.

Collection titles, contribution titles, people lists, and dates can reveal sensitive information. Encrypt them where practical; keep only the minimum identifiers and routing metadata available to the service. Document metadata that remains visible to operators.

### Tide integration

Use TideCloak for authentication and governed identity permissions. Implement or configure verified policies for source review, release to the named composition recipient, and official edition authorization. Source authorization must bind the resource and all required identities. The review audience must be bound to the permission so a server cannot substitute its own recipient.

The exact cross-user encryption mode, resource isolation, approval evidence format, receipt signing operation, and policy lifecycle are design dependencies. Validate them using current Tide guidance and pin working server, SDK, and contract versions. Do not assume that the SDK self-encryption tutorial implements shared memories or arbitrary user consent.

Configure governance so the tested sensitive permission changes actually require multiple administrators. Never derive the source consent threshold from the administrative threshold. Do not claim that every hosting or master-realm action is governed; define and test the protected resource boundary.

### Text processor

For the demo, prefer a processor running on the team's controlled device. The authorized client submits approved text to that disclosed processor and receives suggestions. The processor sees plaintext. If an external provider is selected, add its identity and relevant data handling terms to the composition permission before any submission. Do not send content to an undisclosed fallback.

### PDF issuance

Render once, hash the exact PDF, encrypt the frozen candidate, and provide it to the permitted private review audience. Final approval authorizes an official receipt for those same bytes. A detached receipt avoids the circular problem of inserting approval signatures into a PDF after its digest has been approved. The PDF may already contain its edition identifier before freezing.

Exact preview access also permits a recipient to copy preview content. The issued receipt distinguishes an officially approved edition; it cannot make preview copying impossible. A separately built unofficial PDF has no valid Chorus approval receipt.

## Logical data model

| Entity                | Essential fields                                                                                                           |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| User                  | Stable Tide subject, display profile reference                                                                             |
| Collection            | ID, creator subject, encrypted title and occasion, lifecycle state                                                         |
| Membership            | Collection ID, subject, creator or contributor role, status                                                                |
| Memory                | ID, collection ID, uploader subject, current version reference                                                             |
| MemoryVersion         | ID, encrypted asset and text references, content commitment, protected required approver set, prior version, creation time |
| CompositionPermission | Source version, editor, review audience, processor scope, request digest, authoritative policy reference, revision, status |
| Decision              | Actor subject, request digest, approve or decline or withdraw action, verified authorization evidence, event order         |
| Candidate             | ID, manifest digest, PDF digest, encrypted PDF reference, template version, permission revision dependencies, state        |
| Edition               | Candidate ID, issuance authorization reference, issued time, download scope, receipt reference                             |
| AuditEvent            | Event ID, actor reference, operation, resource reference, authorization revision, outcome, timestamp                       |

Store sensitive manifests and approval records with access appropriate to their contents. A digest is not encryption; do not expose predictable private captions through public content hashes. A public receipt should contain only opaque edition references, file and manifest commitments, authorization proof, and the minimum verification metadata. If a chosen proof format discloses approver identities, obtain explicit permission or keep that receipt private.

## Interface contracts

The precise route names are implementation choices. The following operations must exist:

| Operation                 | Inputs                                                       | Required result                                   |
| ------------------------- | ------------------------------------------------------------ | ------------------------------------------------- |
| Create collection         | Authenticated creator, encrypted collection metadata         | Collection ID and creator membership              |
| Submit memory version     | Encrypted payload, content commitment, declared participants | Immutable version and composition request         |
| Review source             | Authenticated assigned approver, source version              | Resource-specific preview grant or denial         |
| Record source decision    | Exact request digest, actor-bound decision evidence          | Verified decision and updated workflow projection |
| Release source            | Resource, recipient, current permission revision             | Authorized decryption result or policy denial     |
| Freeze candidate          | Exact PDF, manifest, source authorization references         | Immutable candidate and calculated approver set   |
| Record final decision     | Candidate commitments, actor-bound evidence                  | Verified final decision                           |
| Issue edition             | Candidate, current permission dependencies, final evidence   | Policy-authorized receipt or denial               |
| Download official edition | Candidate ID, authenticated named member                     | Exact approved PDF or denial                      |
| Verify receipt            | PDF bytes, receipt, trusted verification configuration       | Valid or invalid result for those exact bytes     |

Every protected operation shall reject cross-collection references, stale commitments, substituted subjects, and an actor acting for another user without the corresponding authority. Decision and issuance mutations shall support idempotent retries. Retrying the same accepted issuance shall return its existing immutable result rather than creating a conflicting edition.

## Security boundaries

| Boundary              | Required protection                                                                      | Remaining limitation                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Remote source storage | Photos and sensitive text are ciphertext; protected release requires valid authority     | Operators can still observe some routing metadata or disrupt availability                  |
| Single administrator  | Tested source permissions and policy changes require the configured governance authority | Colluding authorized parties and untested operational paths are outside that demonstration |
| Composition recipient | Only source versions approved for that recipient are released                            | An authorized recipient can copy plaintext after release                                   |
| AI processor          | Receives only text approved for that named processor                                     | The processor sees submitted plaintext; encryption is not computation over encrypted data  |
| Final review          | Candidate commitments prevent approval being transferred to altered content              | A reviewer can save an authorized preview                                                  |
| Downloaded PDF        | Receipt can verify which exact edition was approved                                      | Readers can copy, edit, print, or forward the PDF outside Chorus                           |

No claim shall be made that Chorus automatically finds everyone represented in a memory, prevents an uploader from sharing their own originals, erases downloaded copies, or protects against a malicious recipient device. A compromised frontend can expose plaintext during an authorized session; protecting storage and policy authority does not eliminate that client risk.

## Nonfunctional requirements

| ID     | Priority | Requirement and validation target                                                                                                                                                                |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-01 | MUST     | Exclude source plaintext, decrypted previews, credentials, and full tokens from backend logs, error reports, analytics, and fixtures. Use synthetic material in the public demo repository.      |
| NFR-02 | MUST     | Fail closed when authentication, approval verification, or the protected release service fails. Do not substitute an application-held master key.                                                |
| NFR-03 | MUST     | Render a readable six-page PDF with embedded resources, correct orientation, no clipped captions, and no hidden excluded assets.                                                                 |
| NFR-04 | SHOULD   | Render the reference PDF within thirty seconds on the documented demo device. Approval waiting time and external service latency shall be reported separately.                                   |
| NFR-05 | SHOULD   | Support layouts at 360 px and 1280 px widths, keyboard navigation, visible focus, programmatically labeled controls, readable contrast, and approval states expressed in text as well as color.  |
| NFR-06 | MUST     | Preserve version and decision history across refreshes and retry interrupted uploads or rendering without falsely displaying success. Partial candidates shall not become eligible for approval. |
| NFR-07 | MUST     | Use HTTPS for non-loopback traffic, keep protected blobs private, and prevent one collection's identifiers from authorizing another's requests.                                                  |
| NFR-08 | SHOULD   | Provide setup instructions, pinned working integration versions, demo accounts or enrollment steps, and a receipt verification command or procedure. Do not publish real credentials.            |
| NFR-09 | MUST     | Display concise, actionable errors for invalid files, expired sessions, missing approval, policy denial, processor failure, and PDF rendering failure. Preserve recoverable work.                |

## Acceptance tests and traceability

| Test  | Scenario and expected result                                                                                                                                                                                                                                      | Requirements                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| AT-01 | Sign in as each of three contributors. An unauthenticated request and a user from another collection cannot retrieve protected collection resources.                                                                                                              | FR-01 to FR-04, NFR-07                 |
| AT-02 | Upload an oversized file, a renamed non-image, an unsupported SVG, and an image above the decoded pixel limit. Each is rejected. A valid rotated JPEG is normalized and its GPS metadata is absent from the retained payload.                                     | FR-05 to FR-07                         |
| AT-03 | Create a memory requiring Alice and Bob. Bob can review that source; an unrelated member cannot. Alice's approval alone cannot release it to the editor. Both valid approvals allow the exact scoped release.                                                     | FR-08 to FR-10                         |
| AT-04 | Set an application database flag to APPROVED, replay an old approval, substitute a recipient, and call decryption directly. Each unauthorized release fails at the protected operation.                                                                           | FR-09, FR-10                           |
| AT-05 | Edit the caption, photo, participant set, or named processing audience. Verify that previous composition authorization cannot release the changed version or scope.                                                                                               | FR-12, FR-16                           |
| AT-06 | Commit withdrawal before a release or issuance request. The later operation fails. Reverse the order and show that an already completed release remains a historical event. Exercise concurrent requests against the documented authoritative revision mechanism. | FR-13, consent concurrency rule        |
| AT-07 | Compose using two available memories and one declined memory. Capture model inputs and inspect rendered pages and PDF embedded assets; the declined source is absent everywhere.                                                                                  | FR-14, FR-17, NFR-03                   |
| AT-08 | Disable or fail the text processor. The user completes a manually captioned six-page collection, and no alternate provider receives content.                                                                                                                      | FR-15, FR-18, NFR-09                   |
| AT-09 | Freeze a candidate. Each approver sees the same PDF digest. One missing or declined final approval prevents official issuance and receipt signing, including by direct request.                                                                                   | FR-19 to FR-21, FR-23                  |
| AT-10 | Change any frozen PDF byte, source version, required approver, or named download member. The old approval evidence does not authorize the changed candidate.                                                                                                      | FR-19, FR-22                           |
| AT-11 | Download an approved edition. Its digest matches the reviewed file, it opens offline in a separate viewer, and its optional receipt verifies. Alter one byte or attach another edition's receipt; verification fails.                                             | FR-23 to FR-25, NFR-03                 |
| AT-12 | As one administrator, propose the tested grant of source decryption rights or governing policy change. Without the configured additional governance approval, the grant does not permit release. Capture evidence from the actual protected operation.            | FR-10, Tide integration boundary       |
| AT-13 | Withdraw after issuance. New app-authorized downloads and later editions are blocked as specified; an already downloaded PDF still opens. The interface explains the difference.                                                                                  | FR-13, FR-24, FR-26                    |
| AT-14 | Inspect remote storage, server logs, and error traces. Sources and candidates are encrypted where specified, and no photo plaintext, private story, credential, or full token appears in logs. Record visible metadata.                                           | FR-07, NFR-01                          |
| AT-15 | Retry an accepted decision and issuance after a simulated connection loss. History contains one logical decision or edition, and the client recovers the committed result.                                                                                        | FR-26, interface contracts, NFR-06     |
| AT-16 | Exercise remaining validation limits, membership removal, declined decisions, edit requests, and final history. Limits are enforced, new access stops on removal, and rejection explanations remain private.                                                      | FR-04, FR-05, FR-11, FR-26             |
| AT-17 | Use the composer and approval flow at both reference widths and with the keyboard. Time a reference render, inspect the six pages, and verify actionable recovery from an expired session and rendering failure.                                                  | FR-15, FR-25, NFR-03 to NFR-05, NFR-09 |

Use actual Tide-protected requests for AT-03, AT-04, AT-06, AT-09, and AT-12 before claiming their protections are implemented. A mocked policy response is useful for interface development but does not satisfy those tests.

## Integration milestones and release criteria

### Milestone one proves protected access

Demonstrate one encrypted memory with two required source approvers, limited approver review, a named composition recipient, and an unrelated user who cannot decrypt it. Verify replay resistance, withdrawal semantics, and a sensitive governance change requiring multiple administrators. Record the working SDK, server, contract, resource binding, and proof formats.

This milestone is the critical dependency. If the required policy behavior cannot be demonstrated, request Tide integration guidance or reduce optional functionality. Do not describe ordinary backend permission checks as equivalent protection.

### Milestone two completes the collection workflow

Implement authenticated membership, encrypted uploads, immutable versions, consent decisions, and the fixed photozine composer. Add the optional text processor only after the manual path works.

### Milestone three issues an approved photozine

Implement frozen candidate review, final approvals, policy-authorized receipt issuance, exact-byte PDF download, and offline verification. Demonstrate blocked material being excluded and an approved collection successfully exporting.

The complete MVP passes every MUST requirement and its applicable acceptance tests, with the deployment and supported security boundary documented. SHOULD and MAY work may be deferred explicitly. A partial prototype must identify unmet MUST requirements in its README and demonstration.

## Decisions to verify during implementation

1. Which currently supported Tide policy and encryption flow provides resource-specific cross-user review and unanimous contributor-controlled source release?
2. Which authoritative mechanism enforces withdrawal revisions and orders concurrent release requests without trusting mutable application flags?
3. Can the selected policy signing flow validate every final contributor approval and bind a detached receipt to an exact candidate?
4. Which browser PDF renderer produces consistent A5 pages with embedded resources and accessible selectable text? Freeze actual rendered bytes rather than assuming rerenders are identical.
5. Which optional text processor will be disclosed, and what retention behavior applies to its inputs?

## References

- [Chorus Product Specification](chorus-product-spec.md).
- [Tide encryption setup](https://docs.tide.org/Admin/e2ee) describes browser encryption and its governed permission prerequisites.
- [Tide quorum governance](https://docs.tide.org/Core-Concepts/iga-workflow) describes identity change approval and the documented administrative threshold behavior.
- [Forseti policy engine](https://docs.tide.org/Core-Concepts/forseti-engine) describes request validation, approver validation, executor validation, and governed cryptographic operations.

The references establish Tide building blocks. The Chorus-specific permission, edition, revocation, and receipt behavior in this SRD remains an implementation obligation.
