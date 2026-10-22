# Chorus Software Requirements Document

Version 0.3 · 22 October 2026 · Hackathon MVP

Chorus shall let a small group create an approved, downloadable photozine from shared photos, voice notes, videos, and stories, using template creation or optional-at-runtime AI-assisted design through one validated renderer. This SRD defines the required software behavior, trust boundaries, data model, and verification criteria. The [Product Specification](chorus-product-spec.md) defines the intended user experience.

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
- Template mode is a complete default creation path independent of all AI services. The full dual-mode release implements and verifies AI generation when enabled as well as template creation when disabled; AI is optional for each zine and may be globally disabled without redeployment.
- The server defaults AI availability to disabled on missing/invalid configuration. An authorized operator can change availability; this authority grants no contributor consent. Public capability state contains no inference secrets.
- When enabled, the planned demo inference target remains the team's cloud. Eight H200 GPUs are available and demo content is English-only; cloud provider, models/runtime, and final processor selection remain open. CH-21 validates inference with synthetic fixtures; CH-19/CH-18 integrate it. No model recommendation has been adopted as configuration.
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

| ID    | Priority | Requirement                                                                                                                                                                                                                                                                                                                                                                            |
| ----- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-14 | MUST     | Compose only from versions authorized for the editor and review audience. AI inputs additionally require current exact processor scope. Pending, declined, withdrawn, or AI-denied sources shall not enter AI requests or style inference through originals, derivatives, summaries, or cached plans. Manually authorized AI-denied sources may be added through the manual path only. |
| FR-15 | MUST     | Offer a default template mode with at least one complete six-page portrait A5 template, photo/still selection, ordering, attributed quotes/captions, and manual palette/font/layout controls. Support validated AI plans through the same editor and renderer. Template creation shall work from an empty draft without inference or an AI consent decision.                           |
| FR-16 | MUST     | Treat newly written or AI-edited captions and messages as content requiring final approval. If an edit changes the meaning or processing scope of a source contribution, create a revised source version and collect composition permission again.                                                                                                                                     |
| FR-17 | MUST     | Implement AI-assisted creation as an optional-at-runtime capability. Only when server availability and exact processing consent permit it, infer style from authorized visuals/transcripts/stories, return a validated plan and inspiration explanation, and support prompt refinement. Verify at least two distinct directions; retain attribution and human review.                  |
| FR-18 | MUST     | Keep the complete template create-review-issue-download flow operational when AI is disabled, unconfigured, unavailable, or declined. Offer explicit retry or Continue manually on the last accepted draft. No silent provider fallback, automatic processing of manual drafts, or required AI service startup is allowed.                                                             |

### Multimedia processing and design contracts

| ID    | Priority | Requirement                                                                                                                                                                                                                                                                                                                                               |
| ----- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-27 | MUST     | Prepare bounded resized images, manually selected timestamped stills, and audio in the authorized client without AI. Permit contributors to type, attribute, and confirm excerpts with source time ranges. Automatic transcription requires enabled AI and exact transcriber permission; limited pre-consent review makes no model call.                  |
| FR-28 | MUST     | Store encrypted immutable derivatives with source/transform versions, timestamps, commitments, and consent lineage. Model jobs additionally record processor/model provenance and AI configuration revision. Recheck current availability and exact recipient/scope at admission and dispatch; changed processor/use requires new consent.                |
| FR-29 | MUST     | Validate every template-built, manually edited, and AI-generated plan against one versioned component schema and authorized asset references before preview/freeze. Reject scripts/HTML, external fetches, unknown assets, missing lineage, overflow, invalid page counts, or unreadable contrast. Invalid AI output preserves the prior accepted draft.  |
| FR-30 | MUST     | Keep manual style/content edits available in both modes; provide AI explanation and text refinement only when enabled and authorized. Continue manually preserves the accepted plan and provenance. Accepted edits create immutable design revisions; changed source meaning requires renewed source consent and quotations retain timestamp attribution. |
| FR-31 | MUST     | Track complete source/derivative influence closure for every plan, including style-only AI inputs. Mode changes or disabling AI shall not erase provenance, bypass withdrawal, or remove required approvers. Withdrawal invalidates dependent work; removing influence requires rebuilding without its derived content.                                   |

### Creation modes and AI availability

| ID    | Priority | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-32 | MUST     | Expose server-authoritative AI availability and a monotonic configuration revision. Default to disabled if missing, invalid, or unreadable; reject new design, refinement, transcription, visual-analysis, background/retry, and startup-probe model requests when disabled, including direct API calls. Enabling also requires configured processors and current exact consent.                                                    |
| FR-33 | MUST     | Route template generation, AI generation, and manual edits through one DesignPlan validator/preview/PDF engine. Store template/schema versions, original creation provenance, parent revision, and full influence closure. Mode selection alone grants no consent, changes no frozen bytes, and causes no reapproval; actual content/layout edits create a new candidate.                                                           |
| FR-34 | MUST     | Permit only authorized operators to change runtime AI availability and audit the action. Check its current revision at job admission and immediately before protected dispatch. If disable commits first, deny dispatch; invalidate queued/in-flight jobs, cancel where possible, and discard late results. Previously dispatched plaintext cannot be recalled. Re-enable shall not resume invalidated jobs or apply their results. |
| FR-35 | MUST     | Build, start, and operate template creation, protected local media preparation, approvals, issuance, and download with no AI credentials or inference process. Template endpoints and rendering shall have no live-model dependency. AI-off alone shall not invalidate accepted AI drafts, frozen candidates, receipts, or authorized downloads; current source/access rules still apply.                                           |

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

Template mode uses local deterministic preparation and a preset plan builder without inference. AI-enabled demo inference is planned in the team's cloud; eight H200 GPUs are available, with exact cloud provider, model weights/runtime, and processor selection still open. CH-21 must select and benchmark the deployment and model capabilities with synthetic fixtures before CH-19 transcription or CH-18 visual/design processing uses real memories. Each implementation decision records supported formats, model versions, retention, request budgets, and credentials kept server-side. Processor contracts are agreed in CH-21; CH-19 does not depend on completion of CH-18. A separate self-hosted speech-to-text service may be required; a vision model is not assumed to support audio. One service may perform several roles only when each role and received derivative type is disclosed. A team-controlled model is still a named plaintext recipient.

After source and processing permission, prepare resized photos and sparse timestamped frames locally. Transcription may receive only the authorized sanitized audio; design receives only the authorized visual/text subset. If transcription is unavailable, the user may supply and approve their own text; no undisclosed fallback is allowed. Raw full videos are not model inputs in the MVP. Any server proxy is a named authorized processing recipient; it holds plaintext transiently, never logs or persists it unencrypted, and must not become a blanket decryption authority.

A job snapshots exact sources, derivative commitments, scopes, processor/model versions, and current authoritative permission revisions. Dispatch is an ordered protected release, not just a database APPROVED check. Revalidate when dispatching and accepting results. If withdrawal wins, queued work cannot dispatch and late results cannot enter the draft. Requests already released to a processor cannot be recalled. Reusing a cached result is a new use requiring valid scope and lineage.

Template builders, manual edits, and the model produce the same DesignPlan, not executable code: six pages, allowlisted component trees, authorized asset/version references, bounded geometry and typography tokens, text with provenance, palette, design rationale, and full input dependency closure. The shared schema and renderer contract are defined in CH-20. Validate structure, authorized references, page bounds, readable contrast, and resource budgets before rendering. Instructions embedded in source text or media are untrusted data and cannot change processing scope or trigger tools/network requests.

Render every accepted plan using the same pinned local components and fonts. Model SDK/credential initialization and endpoint health probes must remain outside template boot/render paths. A model response is not assumed deterministic; store each accepted plan and exact PDF. Refinements create new draft versions; final review still approves frozen bytes.

### Self-hosted inference deployment

When deployed for enabled AI, CH-21 shall expose authenticated inference endpoints over TLS or a protected internal TLS path; anonymous requests fail. Limit access using network rules or an authenticated gateway and keep service credentials out of browser bundles. Authentication to an inference service does not grant access to protected sources; the authorized dispatcher still validates exact contributor scope and current revisions before release. A dispatch proxy is an explicitly disclosed plaintext recipient rather than a master decryption service.

Pin model/weight identifiers and serving-runtime/container versions, verify their intended-use licenses, and document GPU/VRAM fit, startup/health checks, one-job concurrency, request deadlines, and deployment teardown. Benchmark transcription, visual analysis, structured-plan validity, and latency using synthetic fixtures under the SRD budgets. A private endpoint without working multimodal behavior does not complete the integration.

Configure inference/proxy logs, traces, caches, temporary files, and error reports to avoid source/request plaintext and credentials. Do not train or fine-tune on contributor requests. Persist accepted results only through the encrypted artifact/plan path, clear temporary material after job completion/failure, and document operational retention. Do not route an outage to a managed external AI API. No cloud deployment is provisioned by this document update.

The inference process and privileged cloud operators may inspect authorized plaintext. Self-hosting is not confidential computing, and Tide's protected release does not establish confidentiality inside a GPU process. State that boundary in contributor disclosure and the demonstration.

### Runtime AI configuration and job ordering

CH-22 owns an operator-controlled runtime setting with an enabled flag, monotonic revision, and processor-configuration reference. The UI reads sanitized capabilities; only the backend/authorized dispatcher may enable jobs. A creator choosing AI is not an operator configuration change and cannot bypass an off flag. If a setting cannot be read/validated, block AI while keeping template operations available. Enabling the setting neither approves a source nor automatically submits existing manual content.

Order config changes and dispatch authorization. A job snapshots the config revision; dispatch checks the current revision, source grants, and recipient. Once disabled, queued/stale requests cannot release content. Mark in-flight work invalid and discard its late results, even if AI is re-enabled before it returns. A user must explicitly start a fresh authorized job. Accepted artifacts are separate immutable records: disabling alone does not delete them, relabel their origin, revoke existing final approvals, or trigger a rerender.

Template mode can select local video stills and accept manually verified source-time-range quotes without contacting an ASR service. Both paths write a common plan with provenance. Continue manually edits its latest accepted revision; starting a fresh template or dropping AI influence must keep any dependencies still present in retained text/artifacts. Existing source withdrawal and candidate digest rules apply in both modes.

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
- DesignPlan: encrypted validated plan, template/schema/component versions, original creation provenance, accepted text, optional style/prompt references, full influence closure, parent revision, and processor provenance when applicable.
- AIConfiguration: enabled flag, monotonic revision, operator actor, processor-config reference, change time; only sanitized capability fields are client-visible. ProcessingJob captures that revision plus invalidation/cancellation status.

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

Additional operations shall exist for querying sanitized AI capabilities, authorized/audited runtime enable/disable, building a template plan, continuing a plan manually, preparing local derivatives, dispatching an authorized processing job, reviewing/correcting transcripts and attribution, generating or refining a design, validating/accepting a plan, and invalidating dependent work. Responses include opaque job/plan versions, current state, provenance, and recoverable errors without source plaintext in telemetry. Processing retries use idempotency keys; a retry may recover an existing job, while an explicit regeneration creates a new design revision.

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

| ID     | Priority | Requirement and validation target                                                                                                                                                                                                                                                                                        |
| ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| NFR-01 | MUST     | Exclude source media, transcripts, prompts, decrypted previews, credentials, and full tokens from logs, analytics, error reports, and public fixtures. Use synthetic media in verification.                                                                                                                              |
| NFR-02 | MUST     | Fail closed when authentication, approval verification, or the protected release service fails. Do not substitute an application-held master key.                                                                                                                                                                        |
| NFR-03 | MUST     | Render a readable six-page PDF with embedded resources, correct orientation, no clipped captions, and no hidden excluded assets.                                                                                                                                                                                         |
| NFR-04 | SHOULD   | Render the reference PDF within thirty seconds on the documented demo device. Approval waiting time and external service latency shall be reported separately.                                                                                                                                                           |
| NFR-05 | SHOULD   | Support layouts at 360 px and 1280 px widths, keyboard navigation, visible focus, programmatically labeled controls, readable contrast, and approval states expressed in text as well as color.                                                                                                                          |
| NFR-06 | MUST     | Preserve version and decision history across refreshes and retry interrupted uploads or rendering without falsely displaying success. Partial candidates shall not become eligible for approval.                                                                                                                         |
| NFR-07 | MUST     | Use HTTPS for non-loopback traffic, keep protected blobs private, protect self-hosted inference endpoints with service authentication and restricted access, and prevent one collection's identifiers from authorizing another's requests.                                                                               |
| NFR-08 | SHOULD   | Provide setup instructions, pinned working integration versions, demo accounts or enrollment steps, and a receipt verification command or procedure. Do not publish real credentials.                                                                                                                                    |
| NFR-09 | MUST     | Display concise, actionable errors for invalid files, expired sessions, missing approval, policy denial, processor failure, and PDF rendering failure. Preserve recoverable work.                                                                                                                                        |
| NFR-10 | MUST     | Bound decoded media dimensions/duration, extraction count, request bytes/tokens, execution time, and per-collection job concurrency. Use at most one active AI job per collection; expire abandoned jobs after a documented deadline. Display budget/capability failures without silently omitting source content.       |
| NFR-11 | MUST     | With AI disabled and no inference credentials/service, application startup, template editing, protected local media preparation, approval, receipt issuance, and exact-byte download shall succeed without model calls or startup probes. Failure to load AI configuration blocks AI only, preserving the core workflow. |

## Acceptance tests and traceability

| Test  | Scenario and expected result                                                                                                                                                                                                                                                                                                                    | Requirements                                                              |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| AT-01 | Sign in as each of three contributors. An unauthenticated request and a user from another collection cannot retrieve protected collection resources.                                                                                                                                                                                            | FR-01 to FR-04, NFR-07                                                    |
| AT-02 | Upload oversized or over-duration media, renamed unsupported content, SVG, excessive decoded pixels, and an unsupported codec. Reject each safely. Valid JPEG, audio, video, and text inputs pass; orientation is correct and retained media have no location metadata.                                                                         | FR-05 to FR-07, FR-27, NFR-10                                             |
| AT-03 | Create a memory requiring Alice and Bob. Bob can review that source; an unrelated member cannot. Alice's approval alone cannot release it to the editor. Both valid approvals allow the exact scoped release.                                                                                                                                   | FR-08 to FR-10                                                            |
| AT-04 | Set an application database flag to APPROVED, replay an old approval, substitute a recipient, and call decryption directly. Each unauthorized release fails at the protected operation.                                                                                                                                                         | FR-09, FR-10                                                              |
| AT-05 | Edit caption, photo/audio/video content, participants, processor, purpose, or allowed derivatives. Old authorization cannot release the new version/scope. Manual-use approval without AI permission never authorizes processing.                                                                                                               | FR-09, FR-12, FR-16, FR-28                                                |
| AT-06 | Commit withdrawal before a release or issuance request. The later operation fails. Reverse the order and show that an already completed release remains a historical event. Exercise concurrent requests against the documented authoritative revision mechanism.                                                                               | FR-13, consent concurrency rule                                           |
| AT-07 | Use AI-authorized memories, a declined source, and a manual-only source. Inspect synthetic processor inputs, derived summaries, style lineage, pages, and PDF resources. Declined content is absent everywhere; manual-only content is absent from AI and enters the PDF only by authorized manual addition.                                    | FR-14, FR-17, FR-28, FR-31, NFR-03                                        |
| AT-08 | Disable/unconfigure/fail AI or decline processing. Starting from an empty template draft, complete manual photo selection, local video-still selection, typed attributed audio excerpts, final approval, issuance, and PDF download. No model request or alternate provider is used.                                                            | FR-15, FR-18, FR-27, FR-35, NFR-09, NFR-11                                |
| AT-09 | Freeze a candidate. Each approver sees the same PDF digest. One missing or declined final approval prevents official issuance and receipt signing, including by direct request.                                                                                                                                                                 | FR-19 to FR-21, FR-23                                                     |
| AT-10 | Change a frozen PDF byte, design plan, style-only influencing source, derivative, required approver, or recipient. Old evidence cannot authorize the changed candidate; no regeneration runs on official download.                                                                                                                              | FR-19, FR-22, FR-31                                                       |
| AT-11 | Download an approved edition. Its digest matches the reviewed file, it opens offline in a separate viewer, and its optional receipt verifies. Alter one byte or attach another edition's receipt; verification fails.                                                                                                                           | FR-23 to FR-25, NFR-03                                                    |
| AT-12 | As one administrator, propose the tested grant of source decryption rights or governing policy change. Without the configured additional governance approval, the grant does not permit release. Capture evidence from the actual protected operation.                                                                                          | FR-10, Tide integration boundary                                          |
| AT-13 | Withdraw after issuance. New app-authorized downloads and later editions are blocked as specified; an already downloaded PDF still opens. The interface explains the difference.                                                                                                                                                                | FR-13, FR-24, FR-26                                                       |
| AT-14 | Inspect remote storage and logs after multimedia processing. Sources, derivatives, plans, and candidates are encrypted where required; logs contain no photos, audio, private transcripts/prompts, credentials, or full tokens. Document disclosed processor exposure and operator-visible metadata.                                            | FR-07, FR-28, NFR-01                                                      |
| AT-15 | Retry an accepted decision and issuance after a simulated connection loss. History contains one logical decision or edition, and the client recovers the committed result.                                                                                                                                                                      | FR-26, interface contracts, NFR-06                                        |
| AT-16 | Exercise remaining validation limits, membership removal, declined decisions, edit requests, and final history. Limits are enforced, new access stops on removal, and rejection explanations remain private.                                                                                                                                    | FR-04, FR-05, FR-11, FR-26                                                |
| AT-17 | Exercise template editing, local media review, approval/download, and enabled AI controls at both widths and with keyboard. Inspect six unclipped pages, mode visibility, manual recovery, and separate render/AI timings. Enabled-only evidence is verified separately without blocking template checks.                                       | FR-15, FR-25, FR-33, NFR-03 to NFR-05, NFR-09                             |
| AT-18 | Prepare bounded local stills/images and typed timestamped excerpts without AI. With enabled/consented processing, separately verify real transcription and derivative provenance/budgets. Unsupported codecs fail clearly; pre-consent or disabled model dispatch sends nothing.                                                                | FR-06, FR-27, FR-28, FR-32, NFR-10                                        |
| AT-19 | With AI enabled and exact consent, generate from contrasting authorized synthetic collections without a style prompt. Verify distinct coherent plans, editable explanations/quotes, refinement, and shared-renderer output. Require a real disclosed processor for enabled-mode signoff.                                                        | FR-15, FR-17, FR-30, FR-33                                                |
| AT-20 | Supply malformed plans, executable markup, external URLs, unauthorized asset IDs, excessive pages, overflowing text, unreadable contrast, and source-embedded instructions to change provider. Reject safely before candidate creation and preserve the prior usable draft.                                                                     | FR-29, NFR-02, NFR-09                                                     |
| AT-21 | Withdraw a source used only to infer style. Verify queued dispatch is denied, in-flight late results discarded, cached summaries/plans invalidated, final issuance blocked, and regeneration excludes it. Its approvers remain required for the prior plan. No claim of recalling a completed processor request is made.                        | FR-13, FR-19, FR-22, FR-28, FR-31                                         |
| AT-22 | Separately deploy the optional pinned inference stack with synthetic media. Verify authenticated endpoints, capabilities, plan output, budgets, retention, and operator plaintext disclosure. Stop/omit that stack and demonstrate the independent template flow; no managed API fallback occurs.                                               | FR-07, FR-17, FR-18, FR-28, FR-35, NFR-01, NFR-07, NFR-08, NFR-10, NFR-11 |
| AT-23 | Start with AI disabled and no model credentials/inference service. Complete the template journey from empty draft through approved PDF using photos, local stills, and manually confirmed audio excerpts. Direct/stale design, refinement, transcription, analysis, startup, and background requests are denied; capture zero model dispatches. | FR-18, FR-27, FR-32, FR-35, NFR-11                                        |
| AT-24 | Queue and dispatch controlled jobs, then disable AI. Post-disable queued dispatch fails, late invalidated results cannot overwrite the draft even after re-enable, and no automatic retry occurs. New explicit jobs require current config and consent. Already sent content is not described as recalled.                                      | FR-28, FR-32, FR-34                                                       |
| AT-25 | Accept an AI design, continue manually, and disable AI. Preserve accepted assets/text and full AI/source lineage. Operational toggles alone preserve frozen digest/approvals and authorized downloads; content/layout edits require a new candidate. Independently export a template plan through the same validator/renderer.                  | FR-19, FR-22, FR-30, FR-31, FR-33, FR-35                                  |
| AT-26 | An ordinary member or forged client capability cannot enable AI or bypass disabled endpoints. Missing/invalid config fails to AI-off; an authorized operator change is audited without source plaintext. Re-enabling grants no source/processor consent and does not auto-process manual drafts.                                                | FR-09, FR-26, FR-32, FR-34, NFR-01, NFR-11                                |

Use actual Tide-protected requests for AT-03, AT-04, AT-06, AT-09, and AT-12 before claiming their protections are implemented. A mocked policy response is useful for interface development but does not satisfy those tests.

## Integration milestones and release criteria

### Milestone one proves protected access

Demonstrate one encrypted memory with two required source approvers, limited approver review, a named composition recipient, and an unrelated user who cannot decrypt it. Verify replay resistance, withdrawal semantics, and a sensitive governance change requiring multiple administrators. Record the working SDK, server, contract, resource binding, and proof formats.

This milestone is the critical dependency. If the required policy behavior cannot be demonstrated, request Tide integration guidance or reduce optional functionality. Do not describe ordinary backend permission checks as equivalent protection. CH-21 cloud setup may proceed separately using only synthetic fixtures; its completion does not authorize private source processing.

### Milestone two completes the collection workflow

Implement authenticated membership, encrypted multimedia uploads, immutable versions, separate editor/reviewer and processing permissions, and withdrawal ordering. Define the safe design contract in parallel using synthetic fixtures.

### Milestone three issues an approved photozine

Deliver the independent template composer and backend AI availability gate, then shared validated rendering, frozen candidate review, final approvals, receipts, exact-byte download, and offline verification. This milestone requires no AI credentials/inference deployment. CH-10 no longer depends on CH-18.

### Parallel AI and full dual-mode signoff

CH-21 inference, CH-19 consented processing, and CH-18 design/refinement extend the same plan/editor/renderer. Verify enabled-mode and cross-mode tests separately, including disable races and preserved AI provenance. Both paths must have evidence for a complete dual-mode release; the template milestone and AI-off demo can be completed earlier.

The complete dual-mode release passes every MUST requirement and AT-01 through AT-26 as applicable, including enabled-AI evidence collected separately from an AI-off demo, with the deployment and supported security boundary documented. SHOULD and MAY work may be deferred explicitly. A partial prototype must identify unmet MUST requirements in its README and demonstration.

## Decisions to verify during implementation

1. Which currently supported Tide policy and encryption flow provides resource-specific cross-user review and unanimous contributor-controlled source release?
2. Which authoritative mechanism enforces withdrawal revisions and orders concurrent release requests without trusting mutable application flags?
3. Can the selected policy signing flow validate every final contributor approval and bind a detached receipt to an exact candidate?
4. Which browser PDF renderer produces consistent A5 pages with embedded resources and accessible selectable text? Freeze actual rendered bytes rather than assuming rerenders are identical.
5. Which cloud/GPU and self-hosted models/runtimes support transcription, visual analysis, and structured design within budget, and what measured capacity, retention, and deadlines apply? Establish the deployment in CH-21, then integrate its explicit processor roles in CH-19 and CH-18 before sending private content.
6. Which local media tooling safely validates, strips metadata, extracts frames/audio, and enforces budgets on the reference devices? Verify each supported container/codec rather than assuming browser support.
7. Which shared plan schema, template builders, fonts/components, and renderer constraints support both modes while preserving provenance?
8. Which runtime configuration store and dispatch ordering enforce AI-off across user/API/background paths while preserving accepted drafts, candidates, and downloads?

## References

- [Chorus Product Specification](chorus-product-spec.md).
- [Tide encryption setup](https://docs.tide.org/Admin/e2ee) describes browser encryption and its governed permission prerequisites.
- [Tide quorum governance](https://docs.tide.org/Core-Concepts/iga-workflow) describes identity change approval and the documented administrative threshold behavior.
- [Forseti policy engine](https://docs.tide.org/Core-Concepts/forseti-engine) describes request validation, approver validation, executor validation, and governed cryptographic operations.

The references establish Tide building blocks. The Chorus-specific permission, edition, revocation, and receipt behavior in this SRD remains an implementation obligation.
