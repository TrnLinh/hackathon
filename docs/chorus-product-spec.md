# Chorus Product Specification

Version 0.1 · 22 October 2026 · Hackathon MVP

Chorus helps friends turn shared photos and stories into a downloadable photozine, with the people involved approving how their contributions are used. The first release creates a six-page PDF that users can save, share, or print without needing a Chorus account to read it.

This specification defines the product experience and scope. The [Software Requirements Document](chorus-srd.md) defines implementation requirements and acceptance tests.

## Product purpose

People have meaningful memories scattered across camera rolls and group chats. Making a collection takes effort, and sharing someone else's photo, story, or private joke can put them in an uncomfortable position. Contributors may withhold good material because they do not know what will happen to it.

Chorus makes the creative process collaborative. Contributors choose material, agree on its use, and review the resulting edition. AI can help with wording and arrangement, while the collection preserves the contributors' own voices.

The product promise is: “Turn shared memories into a photozine, with everyone involved having a say in what becomes part of the story.”

## Initial audience and occasion

The initial audience is a small group of friends creating a keepsake for a wedding, graduation, farewell, or reunion. The hackathon demonstration uses three contributors making a collection titled Our First Year Away From Home.

The creator starts and arranges the collection. Contributors add memories and make consent decisions. The same person can hold both roles. A person named as a required approver must enroll and authenticate before approving; the creator cannot approve on their behalf.

An infrastructure administrator operates the service. Administrative access does not automatically grant permission to decrypt all contributions, speak for contributors, or certify an edition as unanimously approved.

## Finished artifact

The MVP exports one portrait A5 PDF with six pages:

1. Cover with a title, optional date range, and approved cover photo.
2. Opening note written or approved by contributors.
3. Photo spread with short captions.
4. One memory told by several people, with each voice attributed.
5. Additional approved memories arranged as a collage.
6. Closing messages and a small edition identifier.

All pages are readable offline. Photos are embedded, text is selectable where supported by the chosen renderer, and the file has no dependency on authenticated image URLs. The MVP targets home printing and screen reading; professional print production is outside scope.

The PDF is the primary download. A separate consent receipt can accompany it and identify the exact approved file. The receipt excludes private source material and individual rejection explanations.

## Product principles

- A declined contribution does not prevent the group from creating something good from other memories.
- Consent is an explicit decision about a particular version and use. Silence does not count as approval.
- Every approval clearly distinguishes private composition and review from distribution of the final downloadable edition.
- Contributors can decline without supplying a reason.
- AI preserves the supplied facts and meaning. It does not invent memories or attribute statements to people who did not make them.
- The PDF remains usable outside Chorus. Chorus does not offer recall or remote control over downloaded copies.

## Consent and distribution model

### Required approvers

Each memory has a required approver set: its uploader plus the people the uploader declares as involved. For the MVP, an involved person is a registered collection member. If someone required has not enrolled, the memory stays private and cannot be submitted for approval; the creator can omit it from the edition.

The application does not use face recognition or claim to discover every affected person. Contributors are responsible for declaring the people involved. The uploader already possesses their original material, so Chorus cannot prevent them from sharing it outside the service.

### Permission to compose and review

Before a memory can be used, every required approver approves its exact photo, caption, story, and declared participants for a specific collection. The approval identifies the permitted editor, private review audience, and AI processor, if any.

Required approvers receive limited access to the material they must review. Other members receive source material only after the composition permission succeeds. The MVP uses a fixed, named review audience for each edition; expanding that audience requires fresh permission for affected memories.

Photo pixels stay outside the AI pipeline in the MVP. An optional text assistant receives only authorized text. A contributor who declines AI processing may still approve a manually composed version.

### Permission to issue the final edition

The creator freezes a PDF candidate and sends it for final review. Every uploader, declared participant, and author of new attributed text represented in that candidate must approve the whole immutable edition. Each person can inspect the entire candidate and focus their review on their own contributions.

The approval states: “I approve this edition as a file that the named collection members can download, keep, print, and share outside Chorus.” It does not promise that recipients will restrict forwarding.

An edition becomes officially approved only when all required approvals are valid for its exact version. Any change to the content, layout, included memories, or download recipient list creates a new candidate and requires new final approvals. Changing the material or processing permissions also requires new composition permission where relevant.

Private review necessarily exposes an authorized preview to reviewers and the editor. They may be able to save or photograph it before final approval. Final approval certifies the official edition; it is not digital rights management over previews or downloaded files.

### Declining and changing a decision

A contributor can decline, suggest an edit, or withdraw an approval before official issuance. A proposed edit creates a new memory version. Affected permissions must be collected again.

Before issuance, a withdrawal blocks new protected releases and official issuance of candidates that depend on it. It does not erase plaintext or previews already received. After issuance, a withdrawal stops the app from issuing new downloads under that permission and excludes the material from new editions until approved again. Copies already downloaded remain outside Chorus's control.

## User journey

### Create a collection

The creator signs in through TideCloak, chooses a title and occasion, and adds contributors. The MVP can use three pre-enrolled demo accounts and a collection join flow; email delivery is unnecessary.

### Contribute a memory

A contributor uploads a JPEG or PNG photo, enters a caption and optional short story, and selects required approvers. They see the intended use and review audience before submission. The client encrypts protected content before storing it remotely.

### Review a contribution

Each required person opens an approval inbox, reviews the relevant source version, and approves or declines. The creator sees whether the memory is available, waiting, or excluded, without requiring a rejection explanation.

### Compose the photozine

The creator selects available memories and arranges them in the fixed template. The interface identifies which material can be used. Declined or pending material is excluded before generation. AI text suggestions are optional, editable, and reviewed as part of the final edition.

### Review and download an edition

The creator freezes the candidate. Reviewers approve its exact version or request changes. The creator can remove a blocked contribution and submit a new candidate, with new approvals. Once approved, authorized members can download the official PDF and optional receipt.

## Main screens

| Screen               | User task                     | Essential content                                                              |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------ |
| Collections          | Start or open a collection    | Title, occasion, member count, progress                                        |
| Collection workspace | Coordinate contributions      | Memory cards, permission status, add memory action                             |
| Memory editor        | Submit a photo and story      | Photo preview, caption, story, required people, use scope                      |
| Approval inbox       | Decide on a source or edition | Exact version, audience, processing disclosure, approve, decline, request edit |
| Zine composer        | Arrange authorized material   | Six-page preview, selected memories, caption edits, optional text assistance   |
| Edition review       | Approve a frozen candidate    | Complete PDF preview, edition ID, distribution notice, approval progress       |
| Download             | Save an approved edition      | PDF download, optional receipt, reminder about unrestricted copies             |

## MVP scope

The core release includes TideCloak authentication, three demo contributors, one collection, encrypted photo and text contributions, explicit required approvers, real source access enforcement, a fixed six-page layout, final edition approvals, and a downloadable PDF.

One visual style is sufficient for the MVP: a restrained scrapbook with warm backgrounds, generous margins, readable type, and short attributed captions. Other styles are future options. The layout must gracefully handle a photo or story being removed.

Optional AI text assistance is included only after the encrypted contribution and approval path works. Manual captions and deterministic layout must still produce a complete photozine.

Future releases may add multiple templates, longer collections, collaborative layout editing, voice transcription, video, and print fulfillment. The MVP excludes voice cloning, facial identification, public galleries, a social feed, payments, external sharing integrations, and automatic publishing.

## TideCloak contribution

TideCloak supplies identity and the foundation for encrypted access and administrative governance. Its encryption guide describes browser encryption with governed permissions. Its QEA documentation describes quorum approval for identity and permission changes. Forseti provides programmable validation for protected operations. [Encryption guide](https://docs.tide.org/Admin/e2ee), [QEA guide](https://docs.tide.org/Core-Concepts/iga-workflow), [Forseti guide](https://docs.tide.org/Core-Concepts/forseti-engine).

Chorus must implement the application-specific requirement that every named approver consents to a version. Administrative quorum is a separate policy and cannot stand in for those contributors. Likewise, a standard self-encryption example is not proof that cross-user review or sharing works.

The first implementation milestone must demonstrate the cross-user access policy on one encrypted memory. The exact policy-backed encryption, approval, withdrawal, and receipt mechanism remains an integration dependency until verified. A prototype that only hides a button while leaving plaintext available to the backend does not satisfy this scope.

## Success measures

The hackathon build succeeds when three people can contribute, approve, and create a coherent six-page photozine; a blocked source cannot be retrieved through a direct unauthorized request; one administrator cannot independently grant that access; and the resulting PDF opens offline on another device.

The final edition identifies its exact approved content. An altered candidate or receipt must not pass verification. An excluded memory must be absent from model inputs, rendered pages, and PDF resources.

Provisional usability targets are a complete creation session within ten minutes, excluding time spent waiting for other people, and PDF rendering within thirty seconds on the reference demo device. These are validation targets, not measured results.

## Hackathon demonstration

1. Open a collection containing several ordinary memories and one sensitive story.
2. Show that a missing source approval prevents a direct decryption attempt.
3. Show one administrator's permission change remaining pending because additional governance approval is required.
4. Omit the blocked story and compose a complete photozine from approved material.
5. Freeze the edition and collect the final contributor approvals.
6. Download the PDF and open it offline in a separate viewer.
7. Show that editing the candidate changes its identity and requires fresh approval.

Use synthetic or explicitly authorized demo photos and stories. The submission must describe which protections work, which external services are mocked, and any integration gaps.

## Delivery order

1. Prove a protected contribution can be reviewed by the right users and released only with all required source approvals. Verify that one administrator cannot bypass the governing permissions.
2. Build collection membership, contribution upload, versioning, and the approval inbox.
3. Build the fixed photozine layout, immutable candidate review, official edition authorization, and PDF download.
4. Add optional AI caption assistance, visual polish, and the demonstration recording.

If the first milestone fails, reduce optional features and resolve the Tide integration before claiming the consent protection is implemented. An interface-only simulation can illustrate the concept but must be labeled as such.
