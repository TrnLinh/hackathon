# Chorus Implementation Backlog

This backlog breaks the remaining photozine MVP into eighteen implementation issues and one tracking issue. The Next.js, Convex, shadcn/ui, and TanStack Router starter is already complete; it is not counted as new work.

The [product specification](chorus-product-spec.md) defines the experience and the [SRD](chorus-srd.md) defines the requirements. The issue definitions in [backlog/issues.json](backlog/issues.json) are the publication source.

## Delivery order

Start with CH-01 and CH-02 to prove real identity, protected sharing, revocation semantics, and signing feasibility. Then build the collection and consent flow, the photozine and final edition flow, and the demonstration. Frontend drafts may be developed against agreed interfaces, but simulated policies do not complete the security gates.

P0 identifies consent and integration gates. P1 completes the required product. P2 is optional. Follow the dependency graph; a P0 ticket can depend on a P1 product capability. No owner or deadline has been assumed.

## Issue index

| ID | Priority | Milestone | Issue | Depends on |

| --- | --- | --- | --- | --- |

| [CH-01](#ch-01) | P0 | M1 Prove protected access | Integrate TideCloak sign-in and authenticated Convex identity | None |

| [CH-02](#ch-02) | P0 | M1 Prove protected access | Prove Tide policies for shared release, revocation, and edition signing | CH-01 |

| [CH-03](#ch-03) | P0 | M2 Collect approved memories | Extend the Convex model for immutable versions and consent history | CH-01, CH-02 |

| [CH-04](#ch-04) | P1 | M2 Collect approved memories | Create collections and manage contributor membership | CH-01, CH-03 |

| [CH-05](#ch-05) | P1 | M2 Collect approved memories | Build validated and encrypted photo memory uploads | CH-02, CH-03, CH-04 |

| [CH-06](#ch-06) | P0 | M2 Collect approved memories | Implement scoped source review and unanimous release policies | CH-02, CH-03, CH-05 |

| [CH-07](#ch-07) | P0 | M2 Collect approved memories | Build the contribution approval inbox and revision flow | CH-06 |

| [CH-08](#ch-08) | P0 | M2 Collect approved memories | Enforce withdrawals and order concurrent consent operations | CH-06, CH-07 |

| [CH-09](#ch-09) | P1 | M3 Create approved photozines | Build the six-page photozine composer using approved sources | CH-04, CH-07 |

| [CH-10](#ch-10) | P1 | M3 Create approved photozines | Render and freeze exact PDF candidates with content manifests | CH-09 |

| [CH-11](#ch-11) | P0 | M3 Create approved photozines | Collect final approvals for an immutable downloadable edition | CH-08, CH-10 |

| [CH-12](#ch-12) | P0 | M3 Create approved photozines | Issue policy-authorized consent receipts and verify them offline | CH-02, CH-03, CH-11 |

| [CH-13](#ch-13) | P1 | M3 Create approved photozines | Download approved PDFs with exact-byte and access checks | CH-08, CH-12 |

| [CH-14](#ch-14) | P1 | M4 Demo readiness | Add consent history, retry safety, and recoverable errors | CH-03, CH-07, CH-08, CH-13 |

| [CH-15](#ch-15) | P1 | M4 Demo readiness | Polish mobile layouts, keyboard access, and PDF performance | CH-09, CH-13 |

| [CH-16](#ch-16) | P1 | M4 Demo readiness | Verify the complete consent and photozine flow against the SRD | CH-08, CH-13, CH-14, CH-15 |

| [CH-17](#ch-17) | P1 | M4 Demo readiness | Prepare the hackathon demonstration and submission documentation | CH-16 |

| [CH-18](#ch-18) | P2 | After MVP | Add optional AI assistance for captions and chapter grouping | CH-08, CH-09 |

## Publication

The Publish Chorus backlog workflow creates missing GitHub issues, labels, milestones, an MVP checklist, and links between dependencies. It runs when the manifest is pushed to main and can also be started manually in Actions. It uses GitHub's repository-scoped workflow token with contents read and issues write permissions; no personal token is required.

Publication is idempotent: stable markers identify issues across retries, including a response lost after creation. Existing issue bodies, completion checkboxes, and closed states are preserved. After a partial run, rerun the workflow. Duplicate existing markers cause publication to stop for reconciliation. Each successful run produces a public summary and an artifact mapping ticket IDs to issue URLs.

Update the JSON source and run npm run backlog:docs to regenerate this file. Re-running publication creates missing issues and preserves existing issue text; edit an already published issue explicitly when its requirements change.

## Completion criteria

The MVP is complete when every MUST requirement is implemented and the applicable SRD acceptance tests have evidence. CH-18 is optional; the manual composition path must work without it. Authorized reviewers and downloaders can copy material they already received, so the product cannot promise recall or DRM.

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

### Acceptance criteria

- [ ] A required reviewer can inspect only the assigned resource; an unrelated user cannot decrypt it.
- [ ] One approval fails to release the source to the editor; both exact approvals succeed.
- [ ] Database flag tampering, stale evidence, and recipient substitution do not bypass protected release.
- [ ] The supported revocation semantics and race ordering are demonstrated; any validity-window limitation is explicit.
- [ ] A signing proof binds a synthetic PDF digest and manifest to all required final approvers; administrative votes do not replace them.
- [ ] A short integration decision record identifies supported APIs, working versions, limitations, and reproducible real-network checks.

Requirements: FR-08, FR-09, FR-10, FR-13, FR-21, FR-23, NFR-02, NFR-08. Acceptance tests: AT-03, AT-04, AT-06, AT-09, AT-12.

This is a release gate. If a requirement is not supported, revise the architecture and SRD explicitly before downstream work claims it. A mocked policy response does not complete this issue.

## CH-03

**Extend the Convex model for immutable versions and consent history**

Priority P0 · M2 Collect approved memories · Dependencies: CH-01, CH-02.

Replace the starter schema with the immutable records and references needed by the approved consent design.

### Scope

- Model collection membership, memory versions, composition scopes, actor decisions, permission revision references, candidates, editions, and audit events.
- Add indexes and validators; separate mutable workflow projections from authoritative signed evidence.
- Define canonical manifest serialization and immutable resource/version identifiers shared by frontend and backend.

### Acceptance criteria

- [ ] Content revisions create new records rather than mutating approved source versions.
- [ ] Required approver sets include uploaders and bind stable identities; unresolved identities cannot be submitted.
- [ ] Ciphertext and sensitive references are distinct from any intentionally visible routing metadata.
- [ ] Decision and candidate records retain exact commitments and authoritative revision references.
- [ ] Retry keys produce one logical mutation, and validation rejects cross-collection references.

Requirements: FR-05, FR-09, FR-12, FR-13, FR-19, FR-26, NFR-06. Acceptance tests: AT-05, AT-15, AT-16.

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

**Build validated and encrypted photo memory uploads**

Priority P1 · M2 Collect approved memories · Dependencies: CH-02, CH-03, CH-04.

Allow contributors to submit a photo, caption, story, and declared participants without sending source plaintext to remote storage.

### Scope

- Build the memory editor and required-person selector; include the uploader automatically.
- Validate file signatures, JPEG/PNG formats, 10 MiB file size, 24 megapixel decoded size, caption/story limits, and twelve active memories per collection.
- Normalize orientation and strip EXIF/GPS before encryption; store only the normalized protected payload.
- Protect thumbnails and previews with the same access model; make interrupted uploads recoverable.

### Acceptance criteria

- [ ] A valid photo, caption, optional story, and attribution are stored as a private immutable draft/version.
- [ ] Unsupported SVG, renamed non-images, oversized files, excessive dimensions, and over-limit text are rejected with useful errors.
- [ ] Retained photos have correct orientation and no EXIF location data.
- [ ] Remote storage, logs, and error traces contain no source photo or story plaintext.
- [ ] A required person who has not enrolled prevents submission for approval; unrelated members see a placeholder.

Requirements: FR-05, FR-06, FR-07, NFR-01, NFR-09. Acceptance tests: AT-02, AT-14, AT-16.

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

### Acceptance criteria

- [ ] Only an assigned approver can obtain the pre-consent review grant for that source.
- [ ] Missing or declined approval denies release to the editor at the protected operation.
- [ ] Every correct required approval enables only the exact version and use scope.
- [ ] Database approval tampering, duplicate actors, stale evidence, substituted recipients, and cross-collection references fail.
- [ ] Editing content, required people, or processing scope requires a new version/request; membership changes never silently widen access.

Requirements: FR-08, FR-09, FR-10, FR-12, NFR-02, NFR-07. Acceptance tests: AT-03, AT-04, AT-05.

Use actual Tide-backed operations for acceptance. Administrative quorum cannot satisfy source contributor consent.

## CH-07

**Build the contribution approval inbox and revision flow**

Priority P0 · M2 Collect approved memories · Dependencies: CH-06.

Give contributors a clear decision about the exact material, private review audience, and proposed use.

### Scope

- Create the source approval inbox with protected previews, attribution, version, editor, audience, and processor disclosures.
- Support approve, decline, and request-edit actions, with no mandatory explanation for declining.
- Show private, awaiting permission, available, and excluded states to permitted users.

### Acceptance criteria

- [ ] A contributor can review the exact photo and text version they are approving.
- [ ] Approve and decline submit authenticated evidence for the displayed request; silence remains pending.
- [ ] Requesting an edit produces a new version and the necessary new approval request.
- [ ] Other members see permission status without private rejection explanations.
- [ ] Expired sessions, policy denial, duplicate submissions, and refreshes do not falsely show success.

Requirements: FR-09, FR-11, FR-12, NFR-09. Acceptance tests: AT-03, AT-05, AT-16.

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

### Acceptance criteria

- [ ] If withdrawal commits first, a later release or issuance request fails.
- [ ] If an authorized release commits first, the later withdrawal does not claim to recall that release.
- [ ] Stale permission revisions cannot issue an edition or authorize a new application download.
- [ ] After issuance, withdrawal blocks new app-authorized downloads and use in new editions until reapproved.
- [ ] The interface and tests describe any explicitly accepted revocation validity window; expiry alone is not represented as immediate withdrawal.

Requirements: FR-13, NFR-02, NFR-06. Acceptance tests: AT-06, AT-13.

An editable Convex status flag alone does not establish the required ordering against a compromised backend.

## CH-09

**Build the six-page photozine composer using approved sources**

Priority P1 · M3 Create approved photozines · Dependencies: CH-04, CH-07.

Turn approved memories into a complete keepsake through a usable manual composition workflow.

### Scope

- Implement one A5 portrait template with cover, opening note, photo spread, multiple perspectives, collage, and closing messages.
- Allow selecting and ordering eligible photos, editing captions, and adding attributed notes.
- Gate source retrieval to the editor and fixed review audience; gracefully reflow when a source is omitted.

### Acceptance criteria

- [ ] The creator can compose all six pages without any AI service.
- [ ] Pending, declined, or withdrawn sources are excluded before layout and rendering.
- [ ] Each source is approved for the named editor and review audience.
- [ ] Text changes retain attribution and are marked for final review; meaning or scope changes require revised source permission.
- [ ] Refreshing or retrying preserves recoverable draft work without turning it into an approved edition.

Requirements: FR-14, FR-15, FR-16, FR-18, NFR-03, NFR-06. Acceptance tests: AT-07, AT-08, AT-17.

The multiple-perspectives page should preserve each contributor's words. New notes must identify the authors whose final approval is required.

## CH-10

**Render and freeze exact PDF candidates with content manifests**

Priority P1 · M3 Create approved photozines · Dependencies: CH-09.

Produce an immutable candidate that reviewers and eventual downloaders see as the same exact file.

### Scope

- Choose and validate a browser PDF renderer, then embed normalized images and required fonts.
- Render once, compute a PDF digest, and create a canonical manifest containing source versions, content ordering, template, approvers, audience, and download scope.
- Encrypt the frozen candidate for its authorized review audience; retain its exact byte sequence.

### Acceptance criteria

- [ ] A six-page A5 PDF opens offline in a separate viewer with correct orientation and unclipped captions.
- [ ] Excluded sources are absent from rendered pages and embedded PDF resources.
- [ ] A byte change, source change, or scope change produces a new candidate identity.
- [ ] Partial or failed rendering cannot create an approvable candidate.
- [ ] A reference render is measured against the provisional thirty-second target, with the device recorded.

Requirements: FR-19, FR-25, NFR-03, NFR-04. Acceptance tests: AT-07, AT-10, AT-11, AT-17.

Do not rerender after approval. Put the edition identifier in the PDF before freezing; approval signatures belong in a detached receipt to avoid a circular digest.

## CH-11

**Collect final approvals for an immutable downloadable edition**

Priority P0 · M3 Create approved photozines · Dependencies: CH-08, CH-10.

Let every represented contributor approve the exact final photozine and its downloadable, shareable distribution scope.

### Scope

- Build full-candidate private review for the previously authorized audience.
- Calculate required final approvers as the union of included source approvers and authors of new attributed text.
- Bind approvals to both PDF and manifest commitments, and invalidate them when the candidate changes.

### Acceptance criteria

- [ ] Every reviewer sees the same exact frozen PDF and intended download members.
- [ ] Approval explicitly acknowledges that the file can be kept, printed, and forwarded outside Chorus.
- [ ] Missing, declined, stale, withdrawn, or substituted approval prevents official issuance.
- [ ] Any edit to bytes, included sources, approver set, or download scope creates a new candidate requiring fresh final approvals.
- [ ] The UI explains that authorized previews can be copied and final approval certifies the official edition rather than providing DRM.

Requirements: FR-20, FR-21, FR-22, NFR-02. Acceptance tests: AT-09, AT-10.

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

### Acceptance criteria

- [ ] History identifies relevant resources, actors, versions, outcomes, and event ordering only to authorized viewers.
- [ ] Repeated submissions create one logical decision or edition.
- [ ] A lost response followed by retry recovers the committed result instead of falsely duplicating or claiming success.
- [ ] A declined decision does not disclose a private explanation to others or in exports.
- [ ] Logs and error traces contain no source plaintext, decrypted previews, secrets, or full tokens.

Requirements: FR-26, NFR-01, NFR-06, NFR-09. Acceptance tests: AT-14, AT-15, AT-16.

Implement idempotency in the earlier endpoint tickets as they land; this ticket completes the cross-flow history and recovery experience.

## CH-15

**Polish mobile layouts, keyboard access, and PDF performance**

Priority P1 · M4 Demo readiness · Dependencies: CH-09, CH-13.

Make the complete creation and approval journey usable at the reference widths and on the demo device.

### Scope

- Review collection, upload, approval, composer, final review, and download screens at 360 px and 1280 px.
- Add keyboard reachability, visible focus, labels, contrast, textual state descriptions, and pending/error feedback.
- Measure rendering and inspect the exported pages; fix clipping and excessive asset size.

### Acceptance criteria

- [ ] All core actions are usable by keyboard with clear focus and labeled controls.
- [ ] Both reference layouts are readable without unintended page overflow; permission states do not rely only on color.
- [ ] Invalid files, expired sessions, policy denial, and render failure have useful recovery guidance.
- [ ] The six-page reference PDF has embedded resources and no clipped captions.
- [ ] Render timings are recorded against the provisional target, with any remaining deviation documented.

Requirements: NFR-03, NFR-04, NFR-05, NFR-09. Acceptance tests: AT-17.

Retain the existing Next.js/TanStack history adapter and verify direct refresh and back/forward after adding workspace routes.

## CH-16

**Verify the complete consent and photozine flow against the SRD**

Priority P1 · M4 Demo readiness · Dependencies: CH-08, CH-13, CH-14, CH-15.

Demonstrate that the integrated MVP satisfies the documented acceptance tests, including direct attempts to bypass consent.

### Scope

- Prepare synthetic fixtures for three contributors, several approved memories, one blocked memory, and multiple governance administrators.
- Automate meaningful policy/API checks and the primary browser journey; document checks that require manual review.
- Inspect source storage, model inputs when AI is present, preview resources, exact PDF bytes, and offline receipt verification.

### Acceptance criteria

- [ ] AT-01 through AT-17 each have recorded evidence or an explicit unmet requirement; a complete MVP has no unmet MUST requirement.
- [ ] The real Tide tests cover missing approvals, role-change governance, database flag tampering, replay, recipient substitution, withdrawal races, and final receipt issuance.
- [ ] The manual composition path works without AI; if AI is omitted, AI-only assertions are identified while exclusion from layout/PDF is still tested.
- [ ] A clean setup can reproduce the contributor-to-approved-PDF journey.
- [ ] No simulated protection is described as verified cryptographic enforcement.

Requirements: NFR-01, NFR-02, NFR-03, NFR-06, NFR-07. Acceptance tests: AT-01, AT-02, AT-03, AT-04, AT-05, AT-06, AT-07, AT-08, AT-09, AT-10, AT-11, AT-12, AT-13, AT-14, AT-15, AT-16, AT-17.

Use actual Tide-protected requests for AT-03, AT-04, AT-06, AT-09, and AT-12. Keep public fixtures free of real personal material.

## CH-17

**Prepare the hackathon demonstration and submission documentation**

Priority P1 · M4 Demo readiness · Dependencies: CH-16.

Show the new possibility clearly: a group creates a keepsake without one administrator controlling every source memory.

### Scope

- Prepare setup/enrollment instructions and a short project overview covering the product, trust constraint, value, TideCloak contribution, and demonstrated behavior.
- Record a concise demonstration of a blocked source, denied unilateral permission change, approved composition, final consent, and offline PDF.
- Identify mocked external services, implemented protections, known limits, and deferred stretch work.

### Acceptance criteria

- [ ] A teammate can follow the setup and reproduce the demonstration without private credentials in the repository.
- [ ] The demonstration visibly includes a real protected denial and a successful approved PDF download.
- [ ] The overview explains the difference between protected source release and copies already received by reviewers or downloaders.
- [ ] The submission materials match the actual implemented state and the organizer's current instructions.
- [ ] Product and SRD links, verification steps, and any unmet requirements are easy to find.

Requirements: NFR-08. Acceptance tests: demonstration and documentation review.

Keep the photozine as the primary artifact. AI assistance is optional and must not delay the required demonstration.

## CH-18

**Add optional AI assistance for captions and chapter grouping**

Priority P2 · After MVP · Dependencies: CH-08, CH-09.

Help contributors polish an approved collection without changing the manual workflow or sending private material to an undisclosed processor.

### Scope

- Offer opt-in text-only caption, heading, and grouping suggestions from the disclosed processor.
- Include processor identity and scope in composition permissions before submission.
- Retain attribution and require review of suggestions; do not submit photo pixels or invent events and quotations.

### Acceptance criteria

- [ ] Only text approved for that exact processor is submitted; blocked memories and photo pixels are absent from requests.
- [ ] Changing processors requires new relevant consent and never triggers a silent provider fallback.
- [ ] The creator can accept, edit, or reject each suggestion, with final approval covering the resulting text.
- [ ] Meaning or processing-scope changes create the required revised source request.
- [ ] Processor failure leaves a complete manual create-review-download journey.

Requirements: FR-17, FR-18, NFR-01, NFR-09. Acceptance tests: AT-07, AT-08.

Stretch work only. Start after the core consent-to-photozine path is demonstrated.
