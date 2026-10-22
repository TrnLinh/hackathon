# Chorus Implementation Backlog

This backlog breaks the multimedia, AI-designed photozine MVP into 21 implementation issues and one tracking issue. The Next.js, Convex, shadcn/ui, and TanStack Router starter is already complete; it is not counted as new work. Product/SRD version 0.2.1 keeps multimedia AI design core and sets self-hosted team-cloud inference as the demo target.

The [product specification](chorus-product-spec.md) defines the experience and the [SRD](chorus-srd.md) defines the requirements. The issue definitions in [backlog/issues.json](backlog/issues.json) are the publication source.

## Delivery order

CH-01 is underway and its authentication scope is unchanged. Continue with CH-02 to prove real identity, scoped sharing (including processors), revocation, and signing feasibility. CH-20 design contracts and CH-21 self-hosted inference can start now using synthetic fixtures without depending on authentication. Frontend drafts may use agreed interfaces, but simulated policies do not complete the security gates.

P0 identifies consent and integration gates. P1 completes the required product. P2 is optional. Follow the dependency graph; a P0 ticket can depend on a P1 product capability. No owner or deadline has been assumed.

## Parallel work groups

1. Now: continue CH-01 authentication while CH-20 defines the design contract and CH-21 establishes self-hosted inference using synthetic fixtures. Neither edits authentication.
2. Protected foundation: CH-02 → CH-03 → CH-04 → CH-05 → CH-06 → CH-07, respecting all listed dependencies.
3. After CH-07: CH-08 withdrawals and CH-09 composer can run in parallel if CH-20 is ready.
4. After CH-08: CH-19 media derivatives → CH-18 real AI art direction, each integrating CH-21 endpoints once ready. This chain can overlap CH-09; CH-18 does not depend on the composer. Agree processor adapters early.
5. Once CH-09 and CH-18 are ready: CH-10 integrated PDF freeze → CH-11 final review → CH-12 receipt → CH-13 download.
6. After CH-13: CH-14 history/recovery and CH-15 polish run in parallel → CH-16 verification → CH-17 demonstration.

## Issue index

| ID | Priority | Milestone | Issue | Depends on |

| --- | --- | --- | --- | --- |

| [CH-01](#ch-01) | P0 | M1 Prove protected access | Integrate TideCloak sign-in and authenticated Convex identity | None |

| [CH-02](#ch-02) | P0 | M1 Prove protected access | Prove Tide policies for shared release, revocation, and edition signing | CH-01 |

| [CH-03](#ch-03) | P0 | M2 Collect approved memories | Extend the Convex model for immutable versions and consent history | CH-01, CH-02 |

| [CH-04](#ch-04) | P1 | M2 Collect approved memories | Create collections and manage contributor membership | CH-01, CH-03 |

| [CH-05](#ch-05) | P1 | M2 Collect approved memories | Build validated and encrypted image, voice, video, and text uploads | CH-02, CH-03, CH-04 |

| [CH-06](#ch-06) | P0 | M2 Collect approved memories | Implement scoped source review and unanimous release policies | CH-02, CH-03, CH-05 |

| [CH-07](#ch-07) | P0 | M2 Collect approved memories | Build the contribution approval inbox and revision flow | CH-06 |

| [CH-08](#ch-08) | P0 | M2 Collect approved memories | Enforce withdrawals and order concurrent consent operations | CH-06, CH-07 |

| [CH-09](#ch-09) | P1 | M3 Create approved photozines | Build an editable six-page composer for validated AI and manual designs | CH-04, CH-07, CH-20 |

| [CH-10](#ch-10) | P1 | M3 Create approved photozines | Render and freeze exact PDF candidates with content manifests | CH-09, CH-18 |

| [CH-11](#ch-11) | P0 | M3 Create approved photozines | Collect final approvals for an immutable downloadable edition | CH-08, CH-10 |

| [CH-12](#ch-12) | P0 | M3 Create approved photozines | Issue policy-authorized consent receipts and verify them offline | CH-02, CH-03, CH-11 |

| [CH-13](#ch-13) | P1 | M3 Create approved photozines | Download approved PDFs with exact-byte and access checks | CH-08, CH-12 |

| [CH-14](#ch-14) | P1 | M4 Demo readiness | Add consent history, retry safety, and recoverable errors | CH-03, CH-07, CH-08, CH-13 |

| [CH-15](#ch-15) | P1 | M4 Demo readiness | Polish mobile layouts, keyboard access, and PDF performance | CH-09, CH-13 |

| [CH-16](#ch-16) | P1 | M4 Demo readiness | Verify the complete consent and photozine flow against the SRD | CH-08, CH-13, CH-14, CH-15 |

| [CH-17](#ch-17) | P1 | M4 Demo readiness | Prepare the hackathon demonstration and submission documentation | CH-16 |

| [CH-18](#ch-18) | P1 | M3 Create approved photozines | Infer photozine style from approved multimedia and support text refinement | CH-08, CH-19, CH-20, CH-21 |

| [CH-19](#ch-19) | P1 | M3 Create approved photozines | Prepare consented transcripts, video stills, and visual derivatives | CH-05, CH-06, CH-08, CH-21 |

| [CH-20](#ch-20) | P1 | M3 Create approved photozines | Define the safe design-plan schema and renderer component contract | None |

| [CH-21](#ch-21) | P1 | M3 Create approved photozines | Establish authenticated self-hosted inference in the team cloud | None |

## Publication

The Publish Chorus backlog workflow creates missing GitHub issues, labels, milestones, an MVP checklist, and links between dependencies. It runs when the manifest is pushed to main and can also be started manually in Actions. It uses GitHub's repository-scoped workflow token with contents read and issues write permissions; no personal token is required.

Publication is idempotent: stable markers identify issues across retries, including a response lost after creation or update. Existing issues are revised only when named by an explicit manifest revision. The current scope is placed first; the complete prior description and implementation notes remain in a historical details block as quoted Markdown, so old checklists are not active tasks. Exact unchanged checked criteria are carried forward. Comments, state, assignments, and custom labels are retained. CH-01 is excluded from scope revision targets; the self-hosted-demo-v1 revision changes only the tracker and CH-16, CH-17, CH-18, and CH-19. Duplicate markers stop publication for reconciliation. The workflow summary/artifact lists created and revised tickets and their URLs.

Update the JSON source and run npm run backlog:docs to regenerate this file. To revise already published scope, add a new unique revision ID and an explicit target list; a revision runs once per issue. Re-running the same revision preserves later human edits and does not append duplicates. Do not reuse a published revision ID for a further scope change.

## Completion criteria

The MVP is complete when every MUST requirement is implemented and AT-01 through AT-22 have applicable evidence. CH-18 is required AI-inferred design, CH-19 handles authorized multimedia derivatives, CH-20 supplies the safe plan contract, and CH-21 proves authenticated self-hosted cloud inference. A complete manual path remains required for decline/outage recovery; manual-only does not complete the AI requirement. Style-only influencing sources retain consent dependencies. Authorized processors/reviewers/downloaders can copy plaintext already received; the product cannot promise recall or DRM.

## CH-01

**Integrate TideCloak sign-in and authenticated Convex identity**

Priority P0 · M1 Prove protected access · Dependencies: none.

Establish a real authenticated identity across the Next.js workspace and Convex before adding private collection operations.

### Scope

- Provision a Tide realm with three contributor identities and at least three distinct governance administrators; verify the configured sensitive-change threshold requires multiple approvals.
- Integrate browser sign-in, session renewal, logout, and Convex token verification using stable subject identifiers.
- Document environment variables and enrollment; keep credentials and tokens outside Git.

### Acceptance criteria

- [ ] Each demo contributor can sign in and is identified by a stable subject in a protected Convex function.
- [ ] Unauthenticated, expired, wrong-issuer, and wrong-audience tokens are rejected by protected backend calls.
- [ ] Logout removes authenticated application access; refresh does not grant a different identity.
- [ ] Governance setup and pinned server/SDK versions are documented without publishing credentials.

Requirements: FR-01, NFR-02, NFR-07, NFR-08. Acceptance tests: AT-01.

Do not treat a client-supplied user ID or an ordinary database role flag as proof of identity.

## CH-02

**Prove Tide policies for shared release, revocation, and edition signing**

Priority P0 · M1 Prove protected access · Dependencies: CH-01.

Resolve the cryptographic integration risks before the product depends on an unverified consent mechanism.

### Scope

- Build a minimal encrypted resource requiring two named source approvers, a limited reviewer grant, and a separate named composition recipient.
- Establish how approval evidence binds content version, resource, recipient, audience, and processor scope.
- Prove an authoritative permission revision and ordering mechanism for withdrawal; separately prove the feasibility of final edition receipt signing.
- Attempt a sensitive permission change as one administrator and verify the actual configured quorum blocks it.
- Prove named processor-recipient binding and separate manual review/editor permission from explicit transcription, visual analysis, and design processing scopes; a team-controlled model is still a plaintext recipient.

### Acceptance criteria

- [ ] A required reviewer can inspect only the assigned resource; an unrelated user cannot decrypt it.
- [ ] One approval fails to release the source to the editor; both exact approvals succeed.
- [ ] Database flag tampering, stale evidence, and recipient substitution do not bypass protected release.
- [ ] The supported revocation semantics and race ordering are demonstrated; any validity-window limitation is explicit.
- [ ] A signing proof binds a synthetic PDF digest and manifest to all required final approvers; administrative votes do not replace them.
- [ ] A short integration decision record identifies supported APIs, working versions, limitations, and reproducible real-network checks.
- [ ] Manual-use approval without the exact processor grant cannot release a source or derivative to that processor; changed recipient, purpose, or derivative type requires fresh consent.

Requirements: FR-08, FR-09, FR-10, FR-13, FR-21, FR-23, NFR-02, NFR-08, FR-28. Acceptance tests: AT-03, AT-04, AT-06, AT-09, AT-12.

This is a release gate. If a requirement is not supported, revise the architecture and SRD explicitly before downstream work claims it. A mocked policy response does not complete this issue.

## CH-03

**Extend the Convex model for immutable versions and consent history**

Priority P0 · M2 Collect approved memories · Dependencies: CH-01, CH-02.

Replace the starter schema with the immutable records and references needed by the approved consent design.

### Scope

- Model collection membership, memory versions, composition scopes, actor decisions, permission revision references, candidates, editions, and audit events.
- Add indexes and validators; separate mutable workflow projections from authoritative signed evidence.
- Define canonical manifest serialization and immutable resource/version identifiers shared by frontend and backend.
- Model MediaAsset, ProcessingJob, DerivedArtifact, and DesignPlan records with media type/codec, source and timestamp lineage, processor/model provenance, explicit grant scopes, immutable plan revisions, and full style-influence closure.

### Acceptance criteria

- [ ] Content revisions create new records rather than mutating approved source versions.
- [ ] Required approver sets include uploaders and bind stable identities; unresolved identities cannot be submitted.
- [ ] Ciphertext and sensitive references are distinct from any intentionally visible routing metadata.
- [ ] Decision and candidate records retain exact commitments and authoritative revision references.
- [ ] Retry keys produce one logical mutation, and validation rejects cross-collection references.
- [ ] Visible and style-only input dependencies and separate editor/reviewer versus processor permissions survive refresh and cannot be silently widened or removed.

Requirements: FR-05, FR-09, FR-12, FR-13, FR-19, FR-26, NFR-06, FR-28, FR-30, FR-31. Acceptance tests: AT-05, AT-15, AT-16, AT-21.

A schema field named encryptedPayload does not provide encryption. Backend approval projections must not become the authority for protected release.

## CH-04

**Create collections and manage contributor membership**

Priority P1 · M2 Collect approved memories · Dependencies: CH-01, CH-03.

Let a creator start a collection and admit authenticated contributors without granting unrestricted memory access.

### Scope

- Build collection creation, listing, detail, and a creator-controlled join flow using the existing TanStack workspace.
- Implement backend ownership and membership checks, including removal.
- Encrypt private collection metadata according to the integration design.

### Acceptance criteria

- [ ] A creator can create a titled collection with an occasion; title length is validated.
- [ ] Three pre-enrolled contributors can join through the controlled flow without email delivery.
- [ ] A user outside the collection cannot read private metadata or mutate membership.
- [ ] A join URL alone does not grant source decryption rights.
- [ ] Removal stops new application-authorized access and does not silently change previously approved audiences.

Requirements: FR-02, FR-03, FR-04, NFR-07. Acceptance tests: AT-01, AT-16.

Keep the creator role separate from contributor consent and administrator governance.

## CH-05

**Build validated and encrypted image, voice, video, and text uploads**

Priority P1 · M2 Collect approved memories · Dependencies: CH-02, CH-03, CH-04.

Let contributors submit bounded multimedia memories and declared people without persisting source plaintext remotely.

### Scope

- Build an image/audio/video/text memory editor with local preview or playback, attribution, caption/story, and declared people including speakers; automatically include the uploader.
- Enforce SRD signatures, codecs, sizes, duration/dimensions, text limits, twelve active memories, and the collection byte budget. Do not trust extensions or supplied metadata.
- Normalize images and remove EXIF/GPS and ancillary location metadata from retained media before encryption; persist no unsanitized original. Explain unsupported codecs or unavailable safe local processing.
- Protect source thumbnails and playback, revoke temporary object URLs, and recover interrupted encrypted uploads. In-app recording is outside scope.

### Acceptance criteria

- [ ] Valid supported JPEG/PNG, audio, video, and text-only inputs create private immutable versions with attribution and required people.
- [ ] Unsupported/renamed files, SVG, excessive bytes or decoded pixels, over-duration media, unsupported codecs, and over-limit text fail before remote persistence with useful errors.
- [ ] Retained media have correct orientation where applicable and no ancillary location metadata; remote storage/logs contain no media or private text plaintext.
- [ ] An unresolved required identity prevents approval submission; unrelated members receive no usable source URL, thumbnail, or playback.
- [ ] Capability and retry failures preserve recoverable work without claiming a successful upload.

Requirements: FR-05, FR-06, FR-07, NFR-01, NFR-09, NFR-10. Acceptance tests: AT-02, AT-14, AT-16, AT-18.

Use the verified SDK or reviewed envelope design from CH-02; do not introduce an application-held master decryption key.

## CH-06

**Implement scoped source review and unanimous release policies**

Priority P0 · M2 Collect approved memories · Dependencies: CH-02, CH-03, CH-05.

Make contribution permissions govern actual resource decryption rather than only interface visibility.

### Scope

- Create resource-specific review grants for assigned approvers.
- Bind composition requests to the memory version, collection, required people, editor, review audience, and processor scope.
- Require every source approver before release to the named composition recipient.
- Implement immutable revision and request validation, including direct-request and replay defenses.
- Separate manual editor/reviewer grants from optional grants for each disclosed processor, purpose, input derivative type, and retention disclosure. Enforce each at protected release, including derivatives.

### Acceptance criteria

- [ ] Only an assigned approver can obtain the pre-consent review grant for that source.
- [ ] Missing or declined approval denies release to the editor at the protected operation.
- [ ] Every correct required approval enables only the exact version and use scope.
- [ ] Database approval tampering, duplicate actors, stale evidence, substituted recipients, and cross-collection references fail.
- [ ] Editing content, required people, or processing scope requires a new version/request; membership changes never silently widen access.
- [ ] Manual approval does not permit AI processing; a pending/declined processor decision blocks transcription, visual analysis, and design requests for that source. Changing processor/scope requires a new request.

Requirements: FR-08, FR-09, FR-10, FR-12, NFR-02, NFR-07, FR-28. Acceptance tests: AT-03, AT-04, AT-05, AT-18.

Use actual Tide-backed operations for acceptance. Administrative quorum cannot satisfy source contributor consent.

## CH-07

**Build the contribution approval inbox and revision flow**

Priority P0 · M2 Collect approved memories · Dependencies: CH-06.

Give contributors a clear decision about the exact material, private review audience, and proposed use.

### Scope

- Create the source approval inbox with protected previews, attribution, version, editor, audience, and processor disclosures.
- Support approve, decline, and request-edit actions, with no mandatory explanation for declining.
- Show private, awaiting permission, available, and excluded states to permitted users.
- Add protected audio/video playback and exact declared speaker review; show separate manual-use and per-processor decisions with derivative/retention disclosure.

### Acceptance criteria

- [ ] A contributor can inspect the exact image/audio/video/text version, attribution, intended derivatives, editor/audience, and named processor role they are approving.
- [ ] Approve and decline submit authenticated evidence for the displayed request; silence remains pending.
- [ ] Requesting an edit produces a new version and the necessary new approval request.
- [ ] Other members see permission status without private rejection explanations.
- [ ] Expired sessions, policy denial, duplicate submissions, and refreshes do not falsely show success.
- [ ] Declining AI processing can leave manual composition available; no processor receives content during limited pre-consent review.

Requirements: FR-09, FR-11, FR-12, NFR-09, FR-28. Acceptance tests: AT-03, AT-05, AT-16.

Approval to compose and privately review is distinct from later approval of a downloadable edition.

## CH-08

**Enforce withdrawals and order concurrent consent operations**

Priority P0 · M2 Collect approved memories · Dependencies: CH-06, CH-07.

Ensure a committed withdrawal prevents later protected releases and official issuance that depend on it.

### Scope

- Implement the authoritative permission revision mechanism proved in CH-02.
- Record decision changes and withdrawal history without rewriting prior events.
- Invalidate dependent candidates and stop new official downloads under withdrawn grants.
- Explain previously released previews and downloaded copies accurately.
- Propagate withdrawal through transcripts, frames, visual summaries, cached plans, style-only influence dependencies, queued jobs, late results, and candidates. Order dispatch as a protected release.

### Acceptance criteria

- [ ] If withdrawal commits first, a later release or issuance request fails.
- [ ] If an authorized release commits first, the later withdrawal does not claim to recall that release.
- [ ] Stale permission revisions cannot issue an edition or authorize a new application download.
- [ ] After issuance, withdrawal blocks new app-authorized downloads and use in new editions until reapproved.
- [ ] The interface and tests describe any explicitly accepted revocation validity window; expiry alone is not represented as immediate withdrawal.
- [ ] A withdrawn style-only source invalidates its dependent design and blocks issuance; queued dispatch is denied and late results discarded. Already dispatched processor exposure is described as irreversible.

Requirements: FR-13, NFR-02, NFR-06, FR-28, FR-31. Acceptance tests: AT-06, AT-13, AT-21.

An editable Convex status flag alone does not establish the required ordering against a compromised backend.

## CH-09

**Build an editable six-page composer for validated AI and manual designs**

Priority P1 · M3 Create approved photozines · Dependencies: CH-04, CH-07, CH-20.

Let the creator inspect and edit a validated design plan while preserving a complete manual create-review-export path.

### Scope

- Build a six-page A5 preview using the shared design-plan contract, supporting cover, opening, photos, attributed perspectives, collage, and closing content.
- Allow eligible photo/still selection, ordering, caption/quote edits, palette/font controls, and a simple manual fallback layout; integrate the AI action/refinement against CH-18 when ready.
- Display the style inspiration, immutable plan revision, transcript/frame provenance, reviewable attribution, job states, and actionable recovery. Recover draft work after refresh.
- Permit manually authorized AI-denied memories only through manual editing; preserve the full input influence closure and reflow on removal.

### Acceptance criteria

- [ ] The creator can compose all six pages without any AI service.
- [ ] Pending, declined, or withdrawn sources are excluded before layout and rendering.
- [ ] Each source is approved for the named editor and review audience.
- [ ] Text changes retain attribution and are marked for final review; meaning or scope changes require revised source permission.
- [ ] Refreshing or retrying preserves recoverable draft work without turning it into an approved edition.
- [ ] Validated fixture plans show at least two distinct compositions; users can inspect inspiration and change style controls without arbitrary generated code or external assets.
- [ ] An accepted AI design or text refinement creates a new draft plan revision; quotes can be corrected with attribution and source permission renewed when meaning changes.

Requirements: FR-14, FR-15, FR-16, FR-18, NFR-03, NFR-06, FR-29, FR-30, FR-31. Acceptance tests: AT-07, AT-08, AT-17, AT-19, AT-20, AT-21.

Start against CH-20 synthetic plans while CH-18 is built. CH-09 alone does not complete the required live AI generation. All influencing sources, including style-only ones, retain final-approval dependencies.

## CH-10

**Render and freeze exact PDF candidates with content manifests**

Priority P1 · M3 Create approved photozines · Dependencies: CH-09, CH-18.

Produce an immutable candidate that reviewers and eventual downloaders see as the same exact file.

### Scope

- Choose and validate a browser PDF renderer, then embed normalized images and required fonts.
- Render the accepted validated plan once; commit exact PDF bytes and a canonical manifest with visible/style-influencing sources, derivative versions, full lineage, plan digest/version, renderer/component/font versions, accepted text, approvers, audience, and download scope.
- Encrypt the frozen candidate for its authorized review audience; retain its exact byte sequence.

### Acceptance criteria

- [ ] A six-page A5 PDF opens offline in a separate viewer with correct orientation and unclipped captions.
- [ ] Excluded sources are absent from rendered pages and embedded PDF resources.
- [ ] A byte change, source change, or scope change produces a new candidate identity.
- [ ] Partial or failed rendering cannot create an approvable candidate.
- [ ] A reference render is measured against the provisional thirty-second target, with the device recorded.
- [ ] Real AI-generated and manual plans both render through the same constrained engine; invalid or stale plans cannot be frozen, and full influence closure determines approvers.

Requirements: FR-19, FR-25, NFR-03, NFR-04, FR-29, FR-31. Acceptance tests: AT-07, AT-10, AT-11, AT-17, AT-20, AT-21.

Do not rerender after approval. Put the edition identifier in the PDF before freezing; approval signatures belong in a detached receipt to avoid a circular digest.

## CH-11

**Collect final approvals for an immutable downloadable edition**

Priority P0 · M3 Create approved photozines · Dependencies: CH-08, CH-10.

Let every represented contributor approve the exact final photozine and its downloadable, shareable distribution scope.

### Scope

- Build full-candidate private review for the previously authorized audience.
- Calculate final approvers from all visible and style-influencing source dependencies, plus authors of new attributed text; display the complete exact candidate for review.
- Bind approvals to both PDF and manifest commitments, and invalidate them when the candidate changes.

### Acceptance criteria

- [ ] Every reviewer sees the same exact frozen PDF and intended download members.
- [ ] Approval explicitly acknowledges that the file can be kept, printed, and forwarded outside Chorus.
- [ ] Missing, declined, stale, withdrawn, or substituted approval prevents official issuance.
- [ ] Any edit to bytes, included sources, approver set, or download scope creates a new candidate requiring fresh final approvals.
- [ ] The UI explains that authorized previews can be copied and final approval certifies the official edition rather than providing DRM.
- [ ] A source that only influenced palette, layout, or headings still contributes required approvers. Regeneration/refinement or withdrawal invalidates the dependent candidate and requires new final review.

Requirements: FR-20, FR-21, FR-22, NFR-02, FR-31. Acceptance tests: AT-09, AT-10, AT-21.

A creator or administrator cannot approve for someone else. Reviewer access is already a release and must have been disclosed in composition permissions.

## CH-12

**Issue policy-authorized consent receipts and verify them offline**

Priority P0 · M3 Create approved photozines · Dependencies: CH-02, CH-03, CH-11.

Provide verifiable evidence that an exact PDF edition received the required contributor approvals.

### Scope

- Use the policy-governed signing operation proved in CH-02 to authorize issuance.
- Bind the receipt to PDF and manifest digests, required evidence, permission revisions, and download scope.
- Provide a documented offline verification procedure with trusted verification configuration.

### Acceptance criteria

- [ ] Official receipt issuance fails without every required valid final approval and current source dependency.
- [ ] Direct API calls and database state edits cannot mint a valid receipt by bypassing the policy.
- [ ] A correct receipt verifies for the exact reviewed PDF; altered bytes or another edition's receipt fail.
- [ ] A public receipt contains no source plaintext, private rejection explanation, or unnecessary contributor identities.
- [ ] Retries of an accepted issuance return the existing immutable edition.

Requirements: FR-23, FR-25, NFR-02, NFR-08. Acceptance tests: AT-09, AT-11.

Receipt verification demonstrates authorization of a file; it cannot stop an authorized recipient from copying or editing that file.

## CH-13

**Download approved PDFs with exact-byte and access checks**

Priority P1 · M3 Create approved photozines · Dependencies: CH-08, CH-12.

Deliver the approved photozine to named members as a file that works outside the application.

### Scope

- Implement the official download path with receipt verification, current access checks, and digest validation.
- Return the stored approved bytes with a readable filename and optional detached receipt.
- Support device saving and ordinary sharing without a recipient Chorus account.

### Acceptance criteria

- [ ] Only a currently authorized named member can use the official app download endpoint.
- [ ] The downloaded PDF digest exactly matches the candidate that received final approval.
- [ ] Expired or withdrawn permission blocks new app-authorized downloads.
- [ ] The PDF opens offline on another device, without authenticated asset URLs.
- [ ] The UI accurately explains that downloaded copies cannot be recalled or forwarding prevented.

Requirements: FR-24, FR-25, NFR-07. Acceptance tests: AT-11, AT-13.

Do not implement social publishing, external sharing integrations, or a new PDF render in this endpoint.

## CH-14

**Add consent history, retry safety, and recoverable errors**

Priority P1 · M4 Demo readiness · Dependencies: CH-03, CH-07, CH-08, CH-13.

Make consent decisions and official issuance understandable and robust during refreshes and interrupted requests.

### Scope

- Expose an authenticated history for decisions, withdrawals, issuance, and download authorization events.
- Use idempotent decision/issuance mutations and recover committed results after a dropped connection.
- Add actionable errors and redact source contents, credentials, and tokens from telemetry.
- Include authorized processing-job dispatch/outcome, derivative invalidation, and design revision history; idempotent retries recover a job while explicit regeneration creates a new revision.

### Acceptance criteria

- [ ] History identifies relevant resources, actors, versions, outcomes, and event ordering only to authorized viewers.
- [ ] Repeated submissions create one logical decision or edition.
- [ ] A lost response followed by retry recovers the committed result instead of falsely duplicating or claiming success.
- [ ] A declined decision does not disclose a private explanation to others or in exports.
- [ ] Logs and error traces contain no source plaintext, decrypted previews, secrets, or full tokens.
- [ ] Media/transcript/style prompts stay out of telemetry; job errors and invalidation explain recovery without exposing private content.

Requirements: FR-26, NFR-01, NFR-06, NFR-09, FR-28, FR-30, FR-31. Acceptance tests: AT-14, AT-15, AT-16, AT-21.

Implement idempotency in the earlier endpoint tickets as they land; this ticket completes the cross-flow history and recovery experience.

## CH-15

**Polish mobile layouts, keyboard access, and PDF performance**

Priority P1 · M4 Demo readiness · Dependencies: CH-09, CH-13.

Make the complete creation and approval journey usable at the reference widths and on the demo device.

### Scope

- Review collection, upload, approval, composer, final review, and download screens at 360 px and 1280 px.
- Add keyboard reachability, visible focus, labels, contrast, textual state descriptions, and pending/error feedback.
- Measure rendering and inspect the exported pages; fix clipping and excessive asset size.
- Check audio/video review, transcript correction, AI processing disclosures, style controls, refinement, budgets, and job recovery. Record processing/AI latency separately from PDF rendering.

### Acceptance criteria

- [ ] All core actions are usable by keyboard with clear focus and labeled controls.
- [ ] Both reference layouts are readable without unintended page overflow; permission states do not rely only on color.
- [ ] Invalid files, expired sessions, policy denial, and render failure have useful recovery guidance.
- [ ] The six-page reference PDF has embedded resources and no clipped captions.
- [ ] Render timings are recorded against the provisional target, with any remaining deviation documented.

Requirements: NFR-03, NFR-04, NFR-05, NFR-09, NFR-10. Acceptance tests: AT-17, AT-18, AT-19.

Retain the existing Next.js/TanStack history adapter and verify direct refresh and back/forward after adding workspace routes.

## CH-16

**Verify the complete consent and photozine flow against the SRD**

Priority P1 · M4 Demo readiness · Dependencies: CH-08, CH-13, CH-14, CH-15.

Demonstrate that the integrated MVP satisfies the documented acceptance tests, including direct attempts to bypass consent.

### Scope

- Prepare authorized synthetic image, voice, video, and text fixtures for three contributors, a blocked memory, a manual-only memory, contrasting style collections, and multiple governance administrators.
- Automate meaningful policy/API checks and the primary browser journey; document checks that require manual review.
- Inspect processor dispatches, derivative/style lineage, previews, exact PDF bytes, encrypted persistence, and offline verification. Test malformed plans and media/job budgets.
- Verify self-hosted inference endpoint authentication, model/runtime provenance, synthetic capability/latency evidence, absence of payload logging and frontend credentials, and manual recovery when inference stops.

### Acceptance criteria

- [ ] AT-01 through AT-22 each have evidence or an explicit unmet requirement; a complete MVP has no unmet MUST requirement.
- [ ] The real Tide tests cover missing approvals, role-change governance, database flag tampering, replay, recipient substitution, withdrawal races, and final receipt issuance.
- [ ] Demonstrate real AI generation from multimedia inputs without a required style prompt, visibly distinct directions, and refinement. Also complete the manual journey with processors unavailable or permission declined; manual-only is not a complete MVP.
- [ ] A clean setup can reproduce the contributor-to-approved-PDF journey.
- [ ] No simulated protection is described as verified cryptographic enforcement.

Requirements: NFR-01, NFR-02, NFR-03, NFR-06, NFR-07, FR-27, FR-28, FR-29, FR-30, FR-31, NFR-10. Acceptance tests: AT-01, AT-02, AT-03, AT-04, AT-05, AT-06, AT-07, AT-08, AT-09, AT-10, AT-11, AT-12, AT-13, AT-14, AT-15, AT-16, AT-17, AT-18, AT-19, AT-20, AT-21, AT-22.

Use actual Tide-protected requests for AT-03, AT-04, AT-06, AT-09, and AT-12. Keep public fixtures free of real personal material.

## CH-17

**Prepare the hackathon demonstration and submission documentation**

Priority P1 · M4 Demo readiness · Dependencies: CH-16.

Show the new possibility clearly: a group creates a keepsake without one administrator controlling every source memory.

### Scope

- Prepare setup/enrollment instructions and a short project overview covering the product, trust constraint, value, TideCloak contribution, and demonstrated behavior.
- Record protected denial, denied unilateral permission change, consented image/voice/video processing, automatically inferred design, a style refinement, final consent, and offline PDF.
- Identify mocked external services, implemented protections, known limits, and deferred stretch work.
- Describe the team-cloud inference deployment and verified capabilities, disclose GPU-process/operator plaintext exposure, and provide reproducible startup/teardown instructions without credentials.

### Acceptance criteria

- [ ] A teammate can follow the setup and reproduce the demonstration without private credentials in the repository.
- [ ] The demonstration visibly includes a real protected denial and a successful approved PDF download.
- [ ] The overview explains the difference between protected source release and copies already received by reviewers or downloaders.
- [ ] The submission materials match the actual implemented state and the organizer's current instructions.
- [ ] Product and SRD links, verification steps, and any unmet requirements are easy to find.
- [ ] The demonstration includes real disclosed AI processing and explains its plaintext exposure; the manual fallback is shown as recovery, not a substitute for implemented AI design.

Requirements: NFR-08. Acceptance tests: AT-22.

Keep the downloadable photozine as the primary artifact. AI design is now core. Accurately disclose mocks, unsupported formats, processor/model choices, and any unmet SRD requirement.

## CH-18

**Infer photozine style from approved multimedia and support text refinement**

Priority P1 · M3 Create approved photozines · Dependencies: CH-08, CH-19, CH-20, CH-21.

Use the authorized memories themselves to create an editable, validated six-page design without requiring a style prompt.

### Scope

- Integrate the CH-21 self-hosted visual/design endpoint; record the exact model/runtime, role, retention, budgets, and deadlines in processor disclosures and provenance. Honor the separate CH-19 transcription scope and keep inference credentials server-side.
- Use CH-19 authorized derivatives to infer palette, typography, layout, titles, and editable text. Return one structured six-page plan with short inspiration explanation and complete source/derivative influence closure.
- Support an optional style prompt and text refinement; preserve attribution, review quotes, and create immutable plan revisions. Never fabricate memories, alter source photos, or execute model code.
- Validate through CH-20 before preview; enforce scopes/current revisions at dispatch and result acceptance. Reject stale/malformed output and expose retry/manual recovery without silent provider fallback.
- Integrate the real generation and refinement actions with CH-09; use only bounded resized images, sampled frames, transcripts, and authorized stories, never full raw videos.

### Acceptance criteria

- [ ] Two contrasting authorized multimedia fixture sets generate visibly different coherent designs without a style prompt, using a real disclosed processor.
- [ ] Only exact currently approved derivative types are sent to the named recipient; manual-only, pending, declined, withdrawn, or cross-collection sources never influence the request through caches or summaries.
- [ ] The user can inspect inspiration, edit/reject proposed quotes and captions, and refine style by text; every accepted change produces a new plan revision with provenance.
- [ ] Malformed plans, external URLs, executable markup, unauthorized asset references, missing lineage, overflow, and unreadable contrast fail validation before freezing.
- [ ] Provider failure, processing decline, quota/budget errors, or invalidation preserve manual editing and do not submit content to another provider.
- [ ] All style-influencing source approvers remain part of final consent; a withdrawal discards dependent late results and requires regeneration without that source.
- [ ] Demo processing uses the disclosed team-cloud inference endpoints with service authentication; no managed external AI API is used as an automatic fallback. Endpoint access does not replace contributor consent.

Requirements: FR-14, FR-15, FR-16, FR-17, FR-18, FR-28, FR-29, FR-30, FR-31, NFR-01, NFR-09, NFR-10. Acceptance tests: AT-07, AT-08, AT-18, AT-19, AT-20, AT-21, AT-22.

Required MVP work. Integrate the self-hosted service proved in CH-21; CH-19 supplies consented derivatives. Can overlap CH-09 after its own prerequisites. CH-10 integrates both. Manual recovery does not waive real AI generation.

## CH-19

**Prepare consented transcripts, video stills, and visual derivatives**

Priority P1 · M3 Create approved photozines · Dependencies: CH-05, CH-06, CH-08, CH-21.

Convert protected multimedia into bounded, reviewable AI inputs without bypassing source or processing consent.

### Scope

- Integrate the CH-21 self-hosted transcription endpoint under exact valid permission. Prepare resized images, at most six timestamped frames per clip, and sanitized audio tracks locally; record model/runtime, retention, deadline, and scoped recipient.
- Enforce 1280 px visual long edge, twenty-four visuals, twelve memories, 2,000 transcript code points per recording, 12,000 total source-text code points, and the SRD file/duration/collection budgets. Offer explicit selection/reduction instead of silent truncation.
- Encrypt immutable derivatives with source/transform versions, timestamp ranges, content commitments, processor provenance, and permission lineage; protect previews and remove temporary buffers.
- Provide review/correction of excerpts and declared-speaker attribution. Changed meaning follows source-version consent; no automatic speaker identification.
- Enforce ordered dispatch, bounded deadlines and one active AI job per collection, idempotent retries, withdrawal cancellation/invalidation, and rejection of stale late results.

### Acceptance criteria

- [ ] Authorized photo, voice, video, and text fixtures produce bounded traceable resized images, stills, and reviewed transcript excerpts.
- [ ] No transcriber/visual processor receives content before its explicit permission; pre-consent source review triggers no model request.
- [ ] Over-budget or unsupported media fail with actionable recovery, and users approve any reduced selection; no quote is silently truncated.
- [ ] Encrypted persistence and telemetry contain no plaintext source/derivative content outside the documented transient processor exposure.
- [ ] Withdrawal blocks queued dispatch, invalidates cached/in-flight dependent artifacts, and discards late results without claiming to recall already sent content.
- [ ] Transcript/still selection, source version, and speaker attribution are inspectable before inclusion in the final edition.
- [ ] Demo processing uses the disclosed team-cloud inference endpoints with service authentication; no managed external AI API is used as an automatic fallback. Endpoint access does not replace contributor consent.

Requirements: FR-06, FR-07, FR-27, FR-28, FR-31, NFR-01, NFR-06, NFR-09, NFR-10. Acceptance tests: AT-02, AT-07, AT-14, AT-18, AT-21, AT-22.

CH-21 owns the hosted model/runtime and deployment decision. CH-19 integrates its transcriber and can complete without CH-18; CH-18 integrates visual/design processing. Synthetic adapters unblock UI work but do not complete real processing acceptance. No full raw video is sent to AI.

## CH-20

**Define the safe design-plan schema and renderer component contract**

Priority P1 · M3 Create approved photozines · Dependencies: none.

Give the composer, AI integration, and PDF renderer one safe versioned design contract that can be developed independently of authentication.

### Scope

- Define a versioned six-page A5 DesignPlan schema: component trees, authorized source/derivative references, palette/font tokens, bounded geometry, attributed text, inspiration, and complete influence closure.
- Allowlist local cover/image/grid/collage/quote/heading/caption/note components and fonts. Specify renderer input/output, validation errors, immutable revisions, and manifest commitments.
- Build synthetic warm scrapbook and bold editorial fixtures plus adversarial plans; validate structural limits, cross-reference membership, geometry, contrast, and text bounds.
- Document shared interfaces for CH-09 preview/editing, CH-18 structured output, and CH-10 exact-byte freezing. This is a contract and validation slice, not the full composer or PDF implementation.

### Acceptance criteria

- [ ] Both distinct synthetic styles validate and demonstrate that composition can vary while remaining six portrait A5 pages.
- [ ] Unknown assets/components/fonts, arbitrary HTML/code, network URLs, malformed bounds, wrong page counts, overflow, insufficient contrast, and missing influence references are rejected.
- [ ] Plan revisions, input lineage, schema/component versions, and commitment rules are documented and usable by all three consumers.
- [ ] Work runs on synthetic fixtures without credentials or private collection APIs; fixture validation cannot grant real source access.

Requirements: FR-15, FR-19, FR-29, FR-30, FR-31, NFR-03. Acceptance tests: AT-10, AT-19, AT-20.

Can start now in parallel with CH-01. No edits to authentication or existing in-progress implementation are required. Runtime source authorization remains the responsibility of the protected integration.

## CH-21

**Establish authenticated self-hosted inference in the team cloud**

Priority P1 · M3 Create approved photozines · Dependencies: none.

Provide a reproducible team-controlled cloud inference stack for transcription, visual analysis, and structured design, verified first with synthetic inputs.

### Scope

- Select cloud/GPU capacity, model weights, and pinned serving runtimes after verifying capabilities, intended-use licenses, VRAM fit, cost, startup time, and demo budgets. A separate speech-to-text model is allowed; do not assume one model covers every modality.
- Provide endpoint/adapter contracts for CH-19 transcription and CH-18 visual/structured-design processing, with request limits, model/version provenance, timeouts, health checks, one-job concurrency, and explicit errors.
- Use TLS and authenticated endpoints, restricted network access or an authenticated gateway, and server-side service credentials. Endpoint authentication is separate from protected source/processor consent.
- Disable prompt/media logging, request-based training, and unintended plaintext persistence in the inference/proxy stack; document temporary-data cleanup and retention. Accepted outputs use encrypted artifact storage.
- Benchmark synthetic audio, resized images, video stills, and six-page structured design under SRD budgets. Record output validity and latency separately from PDF rendering.
- Document start/stop/teardown, operational plaintext exposure, and manual recovery. No private memories are used before the separate consent integrations work, and no managed AI API is an automatic fallback.

### Acceptance criteria

- [ ] A teammate can reproduce the pinned deployment from documented configuration without credentials in Git, with the cloud/GPU and model/runtime/license decisions recorded.
- [ ] Anonymous inference requests fail; endpoint access is restricted and browser bundles contain no inference credentials.
- [ ] Synthetic fixtures demonstrate transcription, visual interpretation, and parseable schema-shaped design output; actual plan authorization/validation remains required in CH-18/CH-20.
- [ ] Logs/traces and persistent temporary storage contain no request/media/transcript plaintext or service secrets; retention and failure cleanup are demonstrated.
- [ ] Deadlines, concurrency, and media/request budgets are enforced; service failure supports explicit retry/manual recovery and sends no content to a managed fallback.
- [ ] Documentation acknowledges that the inference process and privileged cloud operators can see authorized plaintext; self-hosting is not claimed to eliminate this trust boundary.

Requirements: FR-07, FR-17, FR-18, FR-28, NFR-01, NFR-07, NFR-08, NFR-10. Acceptance tests: AT-08, AT-14, AT-18, AT-19, AT-22.

Can start alongside CH-01 and CH-20 with synthetic fixtures. Cloud provisioning is implementation work in this ticket, not an action performed by the specification update. Agree endpoint contracts early; hardware and model choices remain open.
