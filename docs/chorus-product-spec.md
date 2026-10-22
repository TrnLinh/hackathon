# Chorus Product Specification

Version 0.2 · 22 October 2026 · Hackathon MVP

Chorus turns shared photos, voice notes, videos, and stories into an AI-designed, downloadable photozine. The memories themselves inspire its style, and the people involved approve both their use and the final edition. The first release creates a six-page PDF that users can save, share, or print without needing a Chorus account to read it.

This specification defines the product experience and scope. The [Software Requirements Document](chorus-srd.md) defines implementation requirements and acceptance tests. Version 0.2 makes multimedia input and AI-directed design core MVP capabilities. CH-01 authentication remains unchanged and can continue while downstream work adapts.

## Product purpose

Meaningful memories are scattered across camera rolls, recordings, and group chats. Turning them into a keepsake takes creative work, and contributors need a say in how private moments are processed and shared.

Chorus uses authorized memories to propose a visual direction: typography, colors, composition, pacing, titles, and editable captions. Contributors retain their own voices and review the result. A style prompt is optional; the collection should provide enough inspiration for a first design.

The product promise is: “Your memories inspire the design. Everyone involved has a say in the story.”

## Initial audience and occasion

The initial audience is a small group of friends creating a keepsake for a wedding, graduation, farewell, or reunion. The hackathon demonstration uses three contributors making Our First Year Away From Home, with photos, a short voice note, and a short video.

The creator starts and arranges the collection. Contributors add memories and make consent decisions. The same person can hold both roles. Required approvers enroll and authenticate before approving; the creator cannot approve on their behalf.

Infrastructure administrators operate the service. Their access does not automatically authorize source decryption, AI processing, contributor decisions, or official edition issuance.

## Finished artifact

The primary output is one portrait A5 PDF with six pages. Its editorial structure covers a title and cover, opening note, photos and captions, multiple attributed perspectives, additional memories, and closing messages. AI may vary page composition and visual treatment within that structure.

Voice notes become reviewed transcript excerpts or attributed quotes. Videos become selected stills with reviewed captions. Original audio and video remain protected source material; the PDF does not require playback, a live media URL, or a Chorus account. Quotes link internally to their source version and timestamp for review; this provenance need not expose private source links in the PDF.

All necessary photos, stills, and fonts are embedded. Text is selectable where supported by the chosen renderer. The MVP targets screen reading and home printing. The optional detached consent receipt identifies the exact approved file without private sources or rejection explanations.

## AI design experience

The creator selects eligible memories and chooses Generate from my memories. An optional instruction, such as “make it playful,” can guide the result. AI analyzes authorized image colors and scenery, transcript themes, and sampled video frames. It proposes one coherent design, a short explanation of its inspiration, and a six-page preview.

For example, sunset photos, laughing friends in a beach clip, and a voice note about a last summer together could inspire a warm scrapbook with film-like accents and handwritten-style headings. Neon city photos and concert memories could inspire a bold editorial treatment. These are creative interpretations that users can change, not claims about contributors' hidden emotions.

The creator can refine the result with text, change colors or typography through controls, replace a photo, edit captions, or return to a simple manual layout. At least two visibly different directions, such as warm scrapbook and bold editorial, must be demonstrated. Styles vary from the inputs; the product does not require users to choose a fixed theme first.

AI returns a structured design plan using supported components: cover, image, grid, collage, quote, heading, caption, and note blocks. A validated renderer builds the preview and PDF. AI never supplies arbitrary executable code, external asset URLs, or the final unreviewed PDF. Layout constraints preserve readability, approved attribution, page bounds, and photo content. Decorative accents are local renderer assets rather than fabricated memory photos.

AI design generation is required for the complete MVP. Manual editing and export remain a full recovery path when processing is declined or unavailable. A manual-only prototype must disclose the missing AI requirement.

## Product principles

- Silence does not count as consent; decisions bind a version and a disclosed use.
- A declined contribution can be omitted without blocking the rest of the collection.
- Source review, AI processing, and final distribution are clearly distinguished.
- Contributors can decline without supplying a reason.
- AI preserves supplied facts and attribution; people review suggested captions and quotes.
- Style inference uses authorized material only, including sources that influence style without appearing directly on a page.
- The downloadable PDF stays usable outside Chorus. Previously released plaintext and downloaded copies cannot be recalled.

## Consent and distribution model

### Required approvers

Each memory requires its uploader and the people declared as involved. For audio and video, this includes declared speakers and represented people. All required people must be registered collection members before submission for approval.

Chorus does not use face recognition, speaker identification, or voice cloning. Uploaders declare affected people and verify quotation attribution. The service cannot stop an uploader from sharing their own original outside Chorus.

### Permission to compose, process, and review

Every required approver reviews the exact retained source version, text, participants, named editor, and fixed private review audience. They separately decide whether specified derivatives may be sent to the disclosed processors. Manual composition permission does not imply permission for AI processing.

The processing disclosure identifies each service and its role: transcription may receive sanitized audio; visual analysis may receive resized photos and selected video frames; design generation may receive authorized transcripts, visual summaries, selected images where disclosed, and an optional prompt. The disclosure states relevant retention behavior and the bounded derivative types. No processor is selected yet; choosing and documenting transcription is part of CH-19, and visual/design processing is part of CH-18, before their respective live submissions.

Local, bounded preparation such as resizing or frame extraction does not authorize an external request. Model-based transcription and image analysis require current explicit processing permission before the service receives content, even if the service runs on a team-controlled machine. Limited source review does not grant processing rights.

Changing the processor, purpose, derivative types, or permitted audience requires new relevant permission. A contributor can permit manual use while declining AI. Such memories remain outside AI requests and automatic style inference and can be added manually under the approved editor/reviewer scope.

Derived transcripts, stills, visual summaries, and style plans inherit their source protections and retain exact lineage. A withdrawn or excluded memory cannot influence a new design through cached summaries or an old style plan. Past processor exposure cannot be undone.

### Permission to issue the final edition

The creator freezes an exact PDF candidate. Every source approver whose memory appears in the PDF or influenced its style, plus authors of new attributed text, must approve the whole immutable edition. This prevents style-only use from bypassing contributor consent. Removing a dependency requires rebuilding the design from the remaining authorized inputs.

The approval states: “I approve this edition as a file that the named collection members can download, keep, print, and share outside Chorus.” It does not promise restrictions on forwarding.

Changes to content, layout, design plan, included or influencing source versions, or recipients create a new candidate with new final approvals. Changed source content or processing scope also requires new composition or processing permission where relevant.

Authorized editors, processors, and reviewers receive plaintext and can copy it. Final approval certifies the official edition; it does not provide DRM over previews or downloaded files.

### Declining and withdrawing

Before issuance, a committed withdrawal blocks later protected release, processing dispatch, derivative reuse, and issuance depending on that permission. Cancel queued work where possible; discard late results from invalidated requests. A request already sent to a processor cannot be recalled.

After issuance, withdrawal stops new app-authorized downloads under that permission and use in later editions until approved again. Historical records remain; downloaded PDFs continue to open.

## User journey and main screens

1. Sign in through TideCloak, create a collection, and admit contributors. Three pre-enrolled demo accounts are sufficient; email delivery is unnecessary.
2. Add a photo, uploaded voice note, short video, or text memory; provide attribution and required people. Validate and sanitize media locally, then encrypt retained sources before remote persistence.
3. In the approval inbox, inspect protected source playback or preview, approve manual editor/reviewer use, and separately approve or decline disclosed AI processing.
4. Generate a design from AI-authorized memories. Inspect the style explanation, proposed quotes, and six-page preview. Edit transcripts and attribution before accepting quotes; refine the style or edit manually.
5. Freeze a candidate, collect every required final approval, and download the exact approved PDF and optional receipt.

The collection workspace shows contribution and processing status. The memory editor shows media type, limits, playback or preview, text, participants, and use scope. The approval inbox shows exact versions and distinct use decisions. The composer shows inspiration, editable pages, style controls, AI job status, and recovery actions. Edition review shows the complete frozen file, edition identifier, distribution notice, and approval progress. Download explains that saved copies can be forwarded.

## MVP scope and limits

The core release includes real TideCloak identity and protected release, three demo contributors, one collection of six to twelve memories, encrypted multimodal sources, explicit review and processing permissions, bounded media preparation, AI-inferred design, manual editing, final edition approvals, and an offline six-page PDF.

The SRD defines enforceable formats and budgets: JPEG/PNG images; short supported audio uploads; short supported videos; bounded transcription, resized images, and sparse frame sampling. Continuous video understanding, long recordings, real-time capture, and live collaborative editing are outside scope. Uploading a voice note is sufficient; an in-app recorder is future work.

The MVP also excludes voice cloning, facial or speaker identification, fabricated memory photos, arbitrary model-generated code, public galleries, social feeds, payments, print fulfillment, professional print production, external sharing integrations, and automatic publishing. Native device saving and ordinary file sharing are sufficient.

## TideCloak contribution

TideCloak supplies identity and the foundation for encrypted access and administrative governance. Its guides describe governed browser encryption, quorum approval for identity and permission changes, and Forseti validation of protected operations. [Encryption guide](https://docs.tide.org/Admin/e2ee), [QEA guide](https://docs.tide.org/Core-Concepts/iga-workflow), [Forseti guide](https://docs.tide.org/Core-Concepts/forseti-engine).

Chorus must implement the distinct requirement that every declared approver consents to an exact version and use. Administrative quorum does not replace contributor consent. A self-encryption example does not establish cross-user sharing or processor-scoped release.

The first integration milestone proves cross-user review and protected release on one encrypted memory, then verifies processor-recipient binding, withdrawal, and receipt feasibility. These remain integration obligations until demonstrated. Hiding a button while plaintext remains accessible to an unauthorized backend does not satisfy them.

## Success measures and demonstration

A successful demonstration uses three people, photos, a voice note, and a video to generate a coherent photozine without a required style prompt. It shows a distinctly different authorized collection producing a different design and a text refinement updating the draft. Transcripts and frame choices remain traceable and reviewable.

The demo must also show a missing approval blocking a direct protected request, one administrator unable to grant access alone, a blocked memory absent from processor inputs and all derivatives, final contributor approval, an exact-byte PDF download, and offline viewing. A subsequent edit requires fresh approval. A failed or declined AI request leaves manual editing usable without contacting another provider.

Use synthetic or explicitly authorized media. Describe working protections, provider exposure, mocks, and unmet requirements accurately. Provisional usability targets remain a ten-minute creation session excluding contributor waiting, and a thirty-second PDF render on the documented device. Media preparation and AI latency are measured separately.

## Delivery order

1. Continue CH-01 unchanged. Prove the protected review, release, withdrawal, and signing integration in CH-02.
2. Define the design-plan and renderer contract in CH-20 using synthetic fixtures; it can proceed independently of authentication. Implement immutable multimedia records, collection membership, protected uploads, and consent UI.
3. After consent and withdrawal gates work, build bounded media processing in CH-19. Build the composer in CH-09 against the contract; implement AI art direction in promoted core ticket CH-18.
4. Integrate the AI and manual paths, freeze exact candidates, collect final approvals, issue receipts, and download. Finish verification, accessibility, and demonstration.

The [backlog](backlog.md) provides dependencies and parallel groups. If an integration gate fails, document the unmet requirement rather than presenting a simulation or manual-only fallback as the complete MVP.
