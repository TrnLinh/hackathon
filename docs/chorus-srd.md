# Chorus Software Requirements Document

Version 0.2 · 22 October 2026 · Hackathon MVP

Chorus shall let a small group create an approved, downloadable photozine from shared photos, voice notes, videos, and stories, with an AI-inferred visual style. This SRD defines the required software behavior, trust boundaries, data model, and verification criteria. The [Product Specification](chorus-product-spec.md) defines the intended user experience.

Requirements marked MUST are necessary for the complete MVP. SHOULD requirements improve the experience and may be deferred with a documented reason. MAY requirements are optional. Numeric limits and performance targets below are proposed engineering defaults.

## Scope and assumptions

- The reference scenario has one collection, three authenticated contributors, six to twelve memories, and a six-page PDF.
- The client runs in a current desktop or mobile browser. The PDF can be read outside Chorus without authentication.
- The demo may use pre-enrolled Tide accounts. No email provider or public gallery is required.
- A collection accepts at most twelve active memories and 120 MiB of selected upload bytes per composition. Text-only memories are supported. All limits are enforced before model dispatch.
- Images: JPEG or PNG; at most 10 MiB and 24 decoded megapixels each. Audio: MP3, AAC in M4A, or Opus in WebM; at most 60 seconds and 10 MiB each. Video: H.264/AAC in MP4 or VP8/Opus in WebM; at most 30 seconds, 40 MiB, and 1920 by 1080 decoded pixels per frame. Unsupported codecs or unavailable safe normalization fail with an actionable format message.
- Inspect stream/container signatures and decoded properties rather than trusting extensions or client metadata. Only sanitized, encrypted retained assets are persisted remotely; originals with location or ancillary metadata are not retained.
- One AI job uses at most twelve memories, twenty-four visual inputs in total, six sampled frames per video, a 1280 px long edge per visual input, 2,000 transcript code points per recording, and 12,000 source-text code points overall. Over-budget selections require explicit user reduction; do not silently truncate a quote. These are initial engineering budgets, not measured capacity.
- A style prompt or refinement accepts at most 500 Unicode code points. Real-time recording, continuous video analysis, generated memory images, and automatic identification are outside scope.
- AI-inferred design is a MUST capability. A usable manual path is also required for declines and outages; it does not waive the AI requirement. No AI provider/model has been selected. CH-19 selects and documents its transcription processor; CH-18 selects and documents visual/design processors. Both record versions, capabilities, data handling, and budgets before live processing.
- CH-01 is already underway. FR-01 and its authentication scope are unchanged by this revision.
- A caption accepts up to 240 Unicode code points, a story up to 2,000, and a collection title up to 80. The interface reports limits before submission.
- At least three distinct administrative identities shall be configured, with the live governance policy verified to require more than one approval for the tested sensitive change. Two administrators alone must not be assumed to establish a two-person threshold.
- The application-specific Tide policies are required integrations, not existing Chorus features. Their feasibility shall be established before the rest of the application depends on them.

## Terminology

| Term                   | Meaning                                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Memory                 | A photo, audio, video, or text contribution with attribution and declared required approvers                                  |
| Memory version         | An immutable revision of that content and its declared participants                                                           |
| Composition permission | Version-bound editor/reviewer use permission and a separately explicit processor scope; manual use does not imply AI use      |
| Candidate              | A frozen PDF and manifest submitted for final review                                                                          |
| Edition                | A candidate with a valid official issuance authorization                                                                      |
| Source approvers       | The uploader plus the declared people involved in a memory                                                                    |
| Edition approvers      | Union of approvers for every visible or style-influencing source, plus authors of new attributed text                         |
| Receipt                | A verifiable authorization that binds an edition to its manifest, exact PDF digest, recipients, and completed final approvals |
| Protected release      | An authorized operation that makes encrypted source or preview content readable to a recipient                                |

## Actors and permissions

| Actor                        | Allowed behavior                                                                              | Restrictions                                                                                   |
| ---------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Creator                      | Create a collection, invite members, select eligible material, edit layout, freeze candidates | Cannot approve for another person or override source access rules                              |
| Contributor                  | Submit and revise their material, review assigned sources, approve or decline candidates      | Membership alone does not permit reading all private sources                                   |
| Authorized download member   | Download an officially approved edition named in their grant                                  | Cannot use that grant for a different candidate                                                |
| Infrastructure administrator | Operate storage and services, propose governed permission changes                             | Administrative access alone does not authorize all source decryption or contributor signatures |
| Disclosed processor          | Receive only the derivative types and purpose explicitly authorized for its named service     | No standing collection access, undisclosed recipients, or silent fallback                      |
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

| ID    | Priority | Requirement                                                                                                                                                                                                                                                                                                                                                           |
| ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-05 | MUST     | Accept supported image, audio, video, or text memories with attribution, optional caption/story, and declared participants including speakers where relevant. Include the uploader; reject an empty or unresolved required identity set.                                                                                                                              |
| FR-06 | MUST     | Enforce the formats and media/text budgets above using signatures and decoded properties. Normalize image orientation; remove EXIF/GPS and ancillary location metadata from retained media. Reject unsupported or unsafe containers/codecs and decompression limits before extraction. Do not persist unsanitized originals remotely.                                 |
| FR-07 | MUST     | Encrypt retained images, audio, video, captions, stories, transcripts, frames, sensitive analysis, and design plans before remote persistence. Use verified SDK behavior or reviewed envelope encryption with policy-protected release. Explicitly authorized processors may receive scoped plaintext transiently; document their handling.                           |
| FR-08 | MUST     | Give an authenticated required approver limited access to the exact source they must review. This review grant shall not give unrelated members or administrators source access.                                                                                                                                                                                      |
| FR-09 | MUST     | Collect every required approver's explicit, version-bound editor/reviewer decision and separate AI processing decision. Bind each processor role, identity, purpose, permitted derivative types, and disclosed retention scope to the request. Manual approval alone shall not authorize AI access; pending or declined processing blocks dispatch to that processor. |
| FR-10 | MUST     | Enforce source release through the protected cryptographic operation. Changing a UI state or a database approval flag alone shall not authorize decryption. Replayed approvals for another version, recipient, or scope shall be rejected.                                                                                                                            |
| FR-11 | MUST     | Let contributors approve, decline, or request an edit without requiring a rejection explanation. Show a contribution as private, awaiting permission, available, or excluded as appropriate.                                                                                                                                                                          |
| FR-12 | MUST     | Create a new immutable memory version when protected content or its participant set changes. Prior permissions shall not authorize that new version. Membership changes shall not silently change its recorded audience.                                                                                                                                              |
| FR-13 | MUST     | Record withdrawal as a new event. Stop later protected releases, processing dispatches, derivative/style-plan reuse, issuance, and app downloads that depend on the withdrawn permission under the ordering rule below. Preserve history; invalidate late processing results. Already dispatched plaintext and downloaded copies cannot be recalled.                  |

### Composition and AI-directed design

| ID    | Priority | Requirement                                                                                                                                                                                                                                                                                                                                                                             |
| ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-14 | MUST     | Compose only from versions authorized for the editor and review audience. AI inputs additionally require current exact processor scope. Pending, declined, withdrawn, or AI-denied sources shall not enter AI requests or style inference through originals, derivatives, summaries, or cached plans. Manually authorized AI-denied sources may be added through the manual path only.  |
| FR-15 | MUST     | Produce six portrait A5 pages with cover, opening, photos/captions, multiple perspectives, additional memories, and closing content. Support at least two visibly distinct AI-inferred design directions, editable typography/palette/composition, photo/still selection, ordering, and captions; include a complete manual fallback layout.                                            |
| FR-16 | MUST     | Treat newly written or AI-edited captions and messages as content requiring final approval. If an edit changes the meaning or processing scope of a source contribution, create a revised source version and collect composition permission again.                                                                                                                                      |
| FR-17 | MUST     | Infer visual style from authorized resized images, sampled video frames, reviewed transcript content, and stories without requiring a style prompt. Produce a structured design plan and a short editable inspiration explanation; support an optional prompt and refinement. Preserve facts and attribution, prohibit invented events/quotes, and require human review of suggestions. |
| FR-18 | MUST     | Preserve the full manual create-review-export workflow when AI permission is declined or a processor fails. Keep recoverable draft work, offer explicit retry or manual use, and never silently change providers. The complete MVP shall also demonstrate successful real AI generation.                                                                                                |

### Multimedia processing and design contracts

| ID    | Priority | Requirement                                                                                                                                                                                                                                                                                                                                                                                               |
| ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-27 | MUST     | Prepare bounded resized images, selected timestamped video stills, and audio tracks in an authorized client. Transcribe only under valid permission for the named transcriber; no remote model processing occurs during pre-consent source review. Enforce job budgets, allow excerpt review/correction, retain original speaker declarations, and require confirmation of quote attribution.             |
| FR-28 | MUST     | Record encrypted immutable derivatives with source version, transformation version, timestamps/ranges, content commitment, applicable permission revisions, and processor provenance. Each dispatch shall recheck current authorization and recipient scope. Changed service, purpose, input type, or retention disclosure requires new consent; providers remain explicit.                               |
| FR-29 | MUST     | Validate every AI plan against a versioned component schema before preview or rendering. Permit only allowlisted fonts, colors, components, asset/version references, and bounded positions/text. Reject scripts/HTML, external fetches, unknown assets, missing lineage, page-count violations, overflow, and unreadable contrast. Invalid output cannot create a candidate.                             |
| FR-30 | MUST     | Offer a reviewable style explanation, editable transcripts/captions/quotes, manual style controls, and text refinement. Each accepted plan/refinement is a new immutable draft design revision. Material meaning changes require renewed source consent under FR-16; accepted quotations retain source/timestamp attribution.                                                                             |
| FR-31 | MUST     | Track the complete dependency closure from all AI inputs through transcripts, visual summaries, design plans, accepted text, and PDF manifest, including style-only inputs. Inherit source protections; union all dependency approvers for final consent. Withdrawal or exclusion invalidates dependent cached/in-flight results and plans; regenerate without that source before freezing a replacement. |

### Candidate review and official issuance

| ID    | Priority | Requirement                                                                                                                                                                                                                                                                                                                                                                |
| ----- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-19 | MUST     | Freeze exact PDF bytes and a canonical immutable manifest containing visible and style-influencing source versions, derivative commitments, design-plan digest/version, renderer/component/font versions, ordered accepted text/content, all required approvers, recipients, and scope. Hash both exact PDF bytes and canonical manifest with collision-resistant digests. |
| FR-20 | MUST     | Provide the exact frozen PDF for private review to the named review audience already authorized by its source permissions. Bind each final approval to the candidate manifest digest and PDF digest. Reviewers shall acknowledge that the approved edition can be kept, printed, and forwarded outside Chorus.                                                             |
| FR-21 | MUST     | Require every edition approver's valid final approval before issuing the official receipt. Missing, declined, stale, withdrawn, substituted, or duplicated identities shall not satisfy the requirement. Administrative quorum shall not replace contributor approvals.                                                                                                    |
| FR-22 | MUST     | Create a new candidate when PDF bytes, design-plan version/digest, included or influencing source versions/derivatives, approvers, recipients, or distribution scope change. Prior final approvals shall not transfer. Regeneration or refinement never mutates an approved candidate.                                                                                     |
| FR-23 | MUST     | Bind the official receipt to the exact candidate and download scope using a verifiable, policy-governed authorization. Direct API calls or database edits shall not produce a valid receipt without the required approvals.                                                                                                                                                |
| FR-24 | MUST     | Return the exact approved PDF without rendering it again after approval. The official download path shall verify the receipt, current application access, and content digest before returning the file.                                                                                                                                                                    |
| FR-25 | MUST     | Embed all image and font resources needed to view the PDF offline. Include an edition identifier, provide a readable filename, and ensure captions are not clipped. Offer an optional detached receipt with a verification procedure.                                                                                                                                      |
| FR-26 | MUST     | Provide authenticated history of source and processing decisions, job dispatch/outcome, derivative invalidation, design revisions, final approvals, withdrawals, issuance, and download authorization. Avoid private prompts/transcripts, rejection explanations, or unnecessary identities in logs, the public receipt, or exported PDF.                                  |

## Consent lifecycle and concurrency

A source starts as PRIVATE. Submitting its immutable version and use scope creates a composition permission request in PENDING state. All required approvals produce APPROVED permission. A decline produces DECLINED permission; changing a decision is recorded as another authenticated event. A content or scope change creates a new request rather than mutating the approved record.

A candidate starts as IN_REVIEW. It becomes READY when every required final decision is approved and every source dependency remains valid. An issuance transaction produces ISSUED status and a receipt. Declines or changes move it to CHANGES_REQUESTED or SUPERSEDED; those states cannot issue a receipt.

Authorization events shall have a defined ordering. Source release or edition issuance must check the latest committed permission revision and bind the result to that revision. If withdrawal commits first, the operation must fail; if an authorized release commits first, the withdrawal cannot recall that release. Requests with stale revisions must retry against current state. Recording an event only in an editable application table is not sufficient to enforce this rule against a compromised backend.

The implementation spike must establish how the Tide policy or another verified authoritative grant mechanism handles current permission revisions, revocation, expiry, and concurrent requests. If immediate revocation is unavailable, the implementation must explicitly document the supported validity window and revise this requirement before presenting it as achieved. Expiry alone is not equivalent to immediate withdrawal.

The creator may omit a blocked memory and freeze a new candidate from remaining approved material. No timeout, creator action, membership removal, or administrator vote may silently stand in for a missing contributor approval. Declared participants cannot be removed from an existing version in place.

## Architecture and data flow

### Client

The browser handles identity interaction, bounded media validation and sanitization, encryption, authorized decryption, frame/audio preparation, layout editing, preview, and PDF rendering. Unsupported local media capabilities fail clearly instead of uploading unsanitized originals. Plaintext required for those actions exists in an authorized client session. Thumbnails and cached previews require the same access protection as their source; unavailable memories use placeholders. Revoke temporary object URLs and release buffers when no longer needed. Do not place source plaintext or tokens in analytics or application logs.

### Application API and storage

The API manages membership, opaque identifiers, encrypted payload locations, immutable version records, and orchestration. Convex stores typed references, immutable records, and workflow projections. A private blob store holds encrypted assets and frozen PDF candidates. Approval eligibility is derived from verifiable authorization, not trusted merely because the database says APPROVED.

Collection titles, contribution titles, people lists, and dates can reveal sensitive information. Encrypt them where practical; keep only the minimum identifiers and routing metadata available to the service. Document metadata that remains visible to operators.

### Tide integration

Use TideCloak for authentication and governed identity permissions. Implement or configure verified policies for source review, release to the named composition recipient, and official edition authorization. Source authorization must bind the resource and all required identities. The review audience must be bound to the permission so a server cannot substitute its own recipient.

The exact cross-user encryption mode, resource isolation, approval evidence format, receipt signing operation, and policy lifecycle are design dependencies. Validate them using current Tide guidance and pin working server, SDK, and contract versions. Do not assume that the SDK self-encryption tutorial implements shared memories or arbitrary user consent.

Configure governance so the tested sensitive permission changes actually require multiple administrators. Never derive the source consent threshold from the administrative threshold. Do not claim that every hosting or master-realm action is governed; define and test the protected resource boundary.

### Disclosed processors and design renderer

No provider or model is selected by this SRD. CH-19 must select and document its transcription processor before live transcription; CH-18 must select and document visual analysis and structured design processors before their live requests. Each implementation decision records supported formats, model versions, retention, request budgets, and credentials kept server-side. Processor contracts are agreed early; CH-19 does not depend on completion of CH-18. One service may perform several roles only when each role and received derivative type is disclosed. A team-controlled model is still a named plaintext recipient.

After source and processing permission, prepare resized photos and sparse timestamped frames locally. Transcription may receive only the authorized sanitized audio; design receives only the authorized visual/text subset. If transcription is unavailable, the user may supply and approve their own text; no undisclosed fallback is allowed. Raw full videos are not model inputs in the MVP. Any server proxy is a named authorized processing recipient; it holds plaintext transiently, never logs or persists it unencrypted, and must not become a blanket decryption authority.

A job snapshots exact sources, derivative commitments, scopes, processor/model versions, and current authoritative permission revisions. Dispatch is an ordered protected release, not just a database APPROVED check. Revalidate when dispatching and accepting results. If withdrawal wins, queued work cannot dispatch and late results cannot enter the draft. Requests already released to a processor cannot be recalled. Reusing a cached result is a new use requiring valid scope and lineage.

The model produces a DesignPlan, not executable code: six pages, allowlisted component trees, authorized asset/version references, bounded geometry and typography tokens, text with provenance, palette, design rationale, and full input dependency closure. The shared schema and renderer contract are defined in CH-20. Validate structure, authorized references, page bounds, readable contrast, and resource budgets before rendering. Instructions embedded in source text or media are untrusted data and cannot change processing scope or trigger tools/network requests.

Render the accepted plan using pinned local components and fonts. A model response is not assumed deterministic; store each accepted plan and exact PDF. Refinements create new draft versions; final review still approves frozen bytes.

### PDF issuance

Render once, hash the exact PDF, encrypt the frozen candidate, and provide it to the permitted private review audience. Final approval authorizes an official receipt for those same bytes. A detached receipt avoids the circular problem of inserting approval signatures into a PDF after its digest has been approved. The PDF may already contain its edition identifier before freezing.

Exact preview access also permits a recipient to copy preview content. The issued receipt distinguishes an officially approved edition; it cannot make preview copying impossible. A separately built unofficial PDF has no valid Chorus approval receipt.

## Logical data model

| Entity                | Essential fields                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| User                  | Stable Tide subject, display profile reference                                                                                                   |
| Collection            | ID, creator subject, encrypted title and occasion, lifecycle state                                                                               |
| Membership            | Collection ID, subject, creator or contributor role, status                                                                                      |
| Memory                | A photo, audio, video, or text contribution with attribution and declared required approvers                                                     |
| MemoryVersion         | ID, encrypted asset and text references, content commitment, protected required approver set, prior version, creation time                       |
| CompositionPermission | Source version, editor, review audience, processor scope, request digest, authoritative policy reference, revision, status                       |
| Decision              | Actor subject, request digest, approve or decline or withdraw action, verified authorization evidence, event order                               |
| Candidate             | ID, manifest/PDF digests, encrypted PDF, design-plan and renderer versions, complete source/derivative dependencies, permission revisions, state |
| Edition               | Candidate ID, issuance authorization reference, issued time, download scope, receipt reference                                                   |
| AuditEvent            | Event ID, actor reference, operation, resource reference, authorization revision, outcome, timestamp                                             |

Additional immutable entities:

- MediaAsset: encrypted normalized asset, verified media type/codec, dimensions/duration, size, content commitment, owner memory version.
- ProcessingJob: exact source/derivative inputs, processor roles and model versions, scope and permission revisions, limits, dispatch identity, state, cancellation/invalidation status.
- DerivedArtifact: encrypted transcript/still/visual summary, source and prior derivative versions, transformation version, timestamps, digest, permission lineage.
- DesignPlan: encrypted validated plan, schema/component versions, accepted text, style explanation, optional prompt reference, full influence closure, parent revision, processor provenance.

MemoryVersion references its media type and encrypted assets/text; CompositionPermission separates manual review/editor scope from explicit processor grants. Candidate includes the plan/renderer/font versions and full influence closure, not only visibly embedded assets.

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

Additional operations shall exist for preparing local derivatives, dispatching an authorized processing job, reviewing/correcting transcripts and attribution, generating or refining a design, validating/accepting a plan, and invalidating dependent work. Responses include opaque job/plan versions, current state, provenance, and recoverable errors without source plaintext in telemetry. Processing retries use idempotency keys; a retry may recover an existing job, while an explicit regeneration creates a new design revision.

Every protected operation shall reject cross-collection references, stale commitments, substituted subjects, and an actor acting for another user without the corresponding authority. Decision and issuance mutations shall support idempotent retries. Retrying the same accepted issuance shall return its existing immutable result rather than creating a conflicting edition.

## Security boundaries

| Boundary              | Required protection                                                                                      | Remaining limitation                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Remote source storage | Media, derivatives, plans, and sensitive text are ciphertext; protected release requires valid authority | Operators can still observe some routing metadata or disrupt availability                  |
| Single administrator  | Tested source permissions and policy changes require the configured governance authority                 | Colluding authorized parties and untested operational paths are outside that demonstration |
| Composition recipient | Only source versions approved for that recipient are released                                            | An authorized recipient can copy plaintext after release                                   |
| AI processor          | Receives only explicitly approved derivative types for its named role                                    | The processor sees submitted plaintext; encryption is not computation over encrypted data  |
| Final review          | Candidate commitments prevent approval being transferred to altered content                              | A reviewer can save an authorized preview                                                  |
| Downloaded PDF        | Receipt can verify which exact edition was approved                                                      | Readers can copy, edit, print, or forward the PDF outside Chorus                           |

No claim shall be made that Chorus automatically finds everyone represented in a memory, prevents an uploader from sharing their own originals, erases downloaded copies, or protects against a malicious recipient device. A compromised frontend can expose plaintext during an authorized session; protecting storage and policy authority does not eliminate that client risk.

## Nonfunctional requirements

| ID     | Priority | Requirement and validation target                                                                                                                                                                                                                                                                                  |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-01 | MUST     | Exclude source media, transcripts, prompts, decrypted previews, credentials, and full tokens from logs, analytics, error reports, and public fixtures. Use synthetic media in verification.                                                                                                                        |
| NFR-02 | MUST     | Fail closed when authentication, approval verification, or the protected release service fails. Do not substitute an application-held master key.                                                                                                                                                                  |
| NFR-03 | MUST     | Render a readable six-page PDF with embedded resources, correct orientation, no clipped captions, and no hidden excluded assets.                                                                                                                                                                                   |
| NFR-04 | SHOULD   | Render the reference PDF within thirty seconds on the documented demo device. Approval waiting time and external service latency shall be reported separately.                                                                                                                                                     |
| NFR-05 | SHOULD   | Support layouts at 360 px and 1280 px widths, keyboard navigation, visible focus, programmatically labeled controls, readable contrast, and approval states expressed in text as well as color.                                                                                                                    |
| NFR-06 | MUST     | Preserve version and decision history across refreshes and retry interrupted uploads or rendering without falsely displaying success. Partial candidates shall not become eligible for approval.                                                                                                                   |
| NFR-07 | MUST     | Use HTTPS for non-loopback traffic, keep protected blobs private, and prevent one collection's identifiers from authorizing another's requests.                                                                                                                                                                    |
| NFR-08 | SHOULD   | Provide setup instructions, pinned working integration versions, demo accounts or enrollment steps, and a receipt verification command or procedure. Do not publish real credentials.                                                                                                                              |
| NFR-09 | MUST     | Display concise, actionable errors for invalid files, expired sessions, missing approval, policy denial, processor failure, and PDF rendering failure. Preserve recoverable work.                                                                                                                                  |
| NFR-10 | MUST     | Bound decoded media dimensions/duration, extraction count, request bytes/tokens, execution time, and per-collection job concurrency. Use at most one active AI job per collection; expire abandoned jobs after a documented deadline. Display budget/capability failures without silently omitting source content. |

## Acceptance tests and traceability

| Test  | Scenario and expected result                                                                                                                                                                                                                                                                                             | Requirements                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| AT-01 | Sign in as each of three contributors. An unauthenticated request and a user from another collection cannot retrieve protected collection resources.                                                                                                                                                                     | FR-01 to FR-04, NFR-07                 |
| AT-02 | Upload oversized or over-duration media, renamed unsupported content, SVG, excessive decoded pixels, and an unsupported codec. Reject each safely. Valid JPEG, audio, video, and text inputs pass; orientation is correct and retained media have no location metadata.                                                  | FR-05 to FR-07, FR-27, NFR-10          |
| AT-03 | Create a memory requiring Alice and Bob. Bob can review that source; an unrelated member cannot. Alice's approval alone cannot release it to the editor. Both valid approvals allow the exact scoped release.                                                                                                            | FR-08 to FR-10                         |
| AT-04 | Set an application database flag to APPROVED, replay an old approval, substitute a recipient, and call decryption directly. Each unauthorized release fails at the protected operation.                                                                                                                                  | FR-09, FR-10                           |
| AT-05 | Edit caption, photo/audio/video content, participants, processor, purpose, or allowed derivatives. Old authorization cannot release the new version/scope. Manual-use approval without AI permission never authorizes processing.                                                                                        | FR-09, FR-12, FR-16, FR-28             |
| AT-06 | Commit withdrawal before a release or issuance request. The later operation fails. Reverse the order and show that an already completed release remains a historical event. Exercise concurrent requests against the documented authoritative revision mechanism.                                                        | FR-13, consent concurrency rule        |
| AT-07 | Use AI-authorized memories, a declined source, and a manual-only source. Inspect synthetic processor inputs, derived summaries, style lineage, pages, and PDF resources. Declined content is absent everywhere; manual-only content is absent from AI and enters the PDF only by authorized manual addition.             | FR-14, FR-17, FR-28, FR-31, NFR-03     |
| AT-08 | Decline AI access or fail each configured processor. Complete a manually edited six-page PDF, preserve the draft, and confirm no alternate service receives content. Separately require successful real AI generation for MVP completion.                                                                                | FR-15, FR-18, NFR-09                   |
| AT-09 | Freeze a candidate. Each approver sees the same PDF digest. One missing or declined final approval prevents official issuance and receipt signing, including by direct request.                                                                                                                                          | FR-19 to FR-21, FR-23                  |
| AT-10 | Change a frozen PDF byte, design plan, style-only influencing source, derivative, required approver, or recipient. Old evidence cannot authorize the changed candidate; no regeneration runs on official download.                                                                                                       | FR-19, FR-22, FR-31                    |
| AT-11 | Download an approved edition. Its digest matches the reviewed file, it opens offline in a separate viewer, and its optional receipt verifies. Alter one byte or attach another edition's receipt; verification fails.                                                                                                    | FR-23 to FR-25, NFR-03                 |
| AT-12 | As one administrator, propose the tested grant of source decryption rights or governing policy change. Without the configured additional governance approval, the grant does not permit release. Capture evidence from the actual protected operation.                                                                   | FR-10, Tide integration boundary       |
| AT-13 | Withdraw after issuance. New app-authorized downloads and later editions are blocked as specified; an already downloaded PDF still opens. The interface explains the difference.                                                                                                                                         | FR-13, FR-24, FR-26                    |
| AT-14 | Inspect remote storage and logs after multimedia processing. Sources, derivatives, plans, and candidates are encrypted where required; logs contain no photos, audio, private transcripts/prompts, credentials, or full tokens. Document disclosed processor exposure and operator-visible metadata.                     | FR-07, FR-28, NFR-01                   |
| AT-15 | Retry an accepted decision and issuance after a simulated connection loss. History contains one logical decision or edition, and the client recovers the committed result.                                                                                                                                               | FR-26, interface contracts, NFR-06     |
| AT-16 | Exercise remaining validation limits, membership removal, declined decisions, edit requests, and final history. Limits are enforced, new access stops on removal, and rejection explanations remain private.                                                                                                             | FR-04, FR-05, FR-11, FR-26             |
| AT-17 | Exercise media review, style controls, composer, approvals, and recovery at both reference widths and with keyboard. Inspect two design directions and six unclipped pages; measure rendering separately from processing/AI latency.                                                                                     | FR-15, FR-25, NFR-03 to NFR-05, NFR-09 |
| AT-18 | With synthetic image, voice, and video sources, enforce all extraction/request budgets; retain timestamped still/transcript provenance. An unapproved transcriber receives nothing. Unsupported codecs fail clearly, and original audio/video are not embedded as live dependencies in the PDF.                          | FR-06, FR-27, FR-28, NFR-10            |
| AT-19 | Generate without a style prompt from two contrasting authorized fixture sets. Obtain visibly different coherent plans with traceable inspiration; refine one by text, inspect editable quotes/attribution, and produce a new plan revision. Require a real disclosed processor for the completion evidence.              | FR-15, FR-17, FR-30                    |
| AT-20 | Supply malformed plans, executable markup, external URLs, unauthorized asset IDs, excessive pages, overflowing text, unreadable contrast, and source-embedded instructions to change provider. Reject safely before candidate creation and preserve the prior usable draft.                                              | FR-29, NFR-02, NFR-09                  |
| AT-21 | Withdraw a source used only to infer style. Verify queued dispatch is denied, in-flight late results discarded, cached summaries/plans invalidated, final issuance blocked, and regeneration excludes it. Its approvers remain required for the prior plan. No claim of recalling a completed processor request is made. | FR-13, FR-19, FR-22, FR-28, FR-31      |

Use actual Tide-protected requests for AT-03, AT-04, AT-06, AT-09, and AT-12 before claiming their protections are implemented. A mocked policy response is useful for interface development but does not satisfy those tests.

## Integration milestones and release criteria

### Milestone one proves protected access

Demonstrate one encrypted memory with two required source approvers, limited approver review, a named composition recipient, and an unrelated user who cannot decrypt it. Verify replay resistance, withdrawal semantics, and a sensitive governance change requiring multiple administrators. Record the working SDK, server, contract, resource binding, and proof formats.

This milestone is the critical dependency. If the required policy behavior cannot be demonstrated, request Tide integration guidance or reduce optional functionality. Do not describe ordinary backend permission checks as equivalent protection.

### Milestone two completes the collection workflow

Implement authenticated membership, encrypted multimedia uploads, immutable versions, separate editor/reviewer and processing permissions, and withdrawal ordering. Define the safe design contract in parallel using synthetic fixtures.

### Milestone three issues an approved photozine

Implement bounded media processing, real AI-inferred design and refinement, a manual composer, validated rendering, frozen candidate review, final approvals, policy-authorized receipts, exact-byte PDF download, and offline verification. Demonstrate blocked material being excluded and an approved collection successfully exporting.

The complete MVP passes every MUST requirement and its applicable acceptance tests, with the deployment and supported security boundary documented. SHOULD and MAY work may be deferred explicitly. A partial prototype must identify unmet MUST requirements in its README and demonstration.

## Decisions to verify during implementation

1. Which currently supported Tide policy and encryption flow provides resource-specific cross-user review and unanimous contributor-controlled source release?
2. Which authoritative mechanism enforces withdrawal revisions and orders concurrent release requests without trusting mutable application flags?
3. Can the selected policy signing flow validate every final contributor approval and bind a detached receipt to an exact candidate?
4. Which browser PDF renderer produces consistent A5 pages with embedded resources and accessible selectable text? Freeze actual rendered bytes rather than assuming rerenders are identical.
5. Which named processors/models support transcription, visual analysis, and structured design, and what retention, capacity, cost, and request deadlines apply? Select and document them in CH-18 before sending private content.
6. Which local media tooling safely validates, strips metadata, extracts frames/audio, and enforces budgets on the reference devices? Verify each supported container/codec rather than assuming browser support.
7. Which versioned design schema, allowlisted fonts/components, and renderer constraints produce two distinct styles while rejecting invalid or unsafe plans?

## References

- [Chorus Product Specification](chorus-product-spec.md).
- [Tide encryption setup](https://docs.tide.org/Admin/e2ee) describes browser encryption and its governed permission prerequisites.
- [Tide quorum governance](https://docs.tide.org/Core-Concepts/iga-workflow) describes identity change approval and the documented administrative threshold behavior.
- [Forseti policy engine](https://docs.tide.org/Core-Concepts/forseti-engine) describes request validation, approver validation, executor validation, and governed cryptographic operations.

The references establish Tide building blocks. The Chorus-specific permission, edition, revocation, and receipt behavior in this SRD remains an implementation obligation.
