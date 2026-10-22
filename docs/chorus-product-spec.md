# Chorus Product Specification

Version 0.3 · 22 October 2026 · Hackathon MVP

Chorus turns shared photos, voice notes, videos, and stories into a downloadable photozine through two creation modes: templates and optional AI-assisted design. Contributors approve their memories' use and the exact final edition in either mode. The first release creates a six-page PDF that users can save, share, or print without needing a Chorus account to read it.

This specification defines the product experience and scope. The [Software Requirements Document](chorus-srd.md) defines implementation requirements and acceptance tests. Version 0.3 makes template creation a first-class independent path, adds a server-controlled AI disable switch, and keeps AI-assisted design as a separately verified capability. This revises the earlier AI-first delivery order; CH-01 authentication scope remains unchanged.

## Product purpose

Meaningful memories are scattered across camera rolls, recordings, and group chats. Turning them into a keepsake takes creative work, and contributors need a say in how private moments are processed and shared.

Creators can choose a template and arrange their memories themselves. When AI is enabled and processing is authorized, Chorus can instead propose typography, colors, composition, pacing, titles, and editable captions from the memories. Contributors retain their own voices and review the result. A style prompt is optional; the collection should provide enough inspiration for a first design.

The product promise is: “Your memories inspire the design. Everyone involved has a say in the story.”

## Initial audience and occasion

The initial audience is a small group of friends creating a keepsake for a wedding, graduation, farewell, or reunion. The hackathon demonstration uses three contributors making Our First Year Away From Home, with photos, a short voice note, and a short video.

The creator starts and arranges the collection. Contributors add memories and make consent decisions. The same person can hold both roles. Required approvers enroll and authenticate before approving; the creator cannot approve on their behalf.

Infrastructure administrators operate the service. Their access does not automatically authorize source decryption, AI processing, contributor decisions, or official edition issuance.

## Finished artifact

The primary output is one portrait A5 PDF with six pages. Its editorial structure covers a title and cover, opening note, photos and captions, multiple attributed perspectives, additional memories, and closing messages. Templates supply preset compositions; AI can propose variations within the same editorial structure and rendering constraints.

Voice notes become reviewed transcript excerpts or attributed quotes. Videos become selected stills with reviewed captions. Original audio and video remain protected source material; the PDF does not require playback, a live media URL, or a Chorus account. Quotes link internally to their source version and timestamp for review; this provenance need not expose private source links in the PDF.

All necessary photos, stills, and fonts are embedded. Text is selectable where supported by the chosen renderer. The MVP targets screen reading and home printing. The optional detached consent receipt identifies the exact approved file without private sources or rejection explanations.

## Two creation modes, one rendering engine

### Template mode

Use a template is the default entry point and remains available at all times. The creator chooses a supported six-page style, places approved photos or video stills, orders memories, and edits captions, quotes, colors, and fonts. At least one complete template is required; the shared component system can support more. It works from an empty draft without calling an AI service, obtaining an AI-processing decision, configuring model credentials, or starting GPU inference.

For voice and video memories, an authorized contributor can listen/watch locally, type and confirm an attributed excerpt with a source time range, and select a video still. Local resizing, sanitization, and still extraction are deterministic media preparation rather than AI. Automatic transcription is an AI action and is unavailable when AI is disabled. Declining AI does not prevent consented manual use of the source.

### AI-assisted mode

When server capabilities permit it, the creator can choose Create with AI, select AI-authorized memories, and generate a draft. An optional instruction, such as “make it playful,” can guide the result. AI analyzes authorized image colors and scenery, transcript themes, and sampled video frames. It proposes one coherent design, a short explanation of its inspiration, and a six-page preview.

For example, sunset photos, laughing friends in a beach clip, and a voice note about a last summer together could inspire a warm scrapbook with film-like accents and handwritten-style headings. Neon city photos and concert memories could inspire a bold editorial treatment. These are creative interpretations that users can change, not claims about contributors' hidden emotions.

The creator can refine the result with text, change colors or typography through controls, replace a photo, edit captions, or return to a simple manual layout. At least two visibly different directions, such as warm scrapbook and bold editorial, must be demonstrated. Styles vary from the inputs; the product does not require users to choose a fixed theme first.

AI returns a structured design plan using supported components: cover, image, grid, collage, quote, heading, caption, and note blocks. A validated renderer builds the preview and PDF. AI never supplies arbitrary executable code, external asset URLs, or the final unreviewed PDF. Layout constraints preserve readability, approved attribution, page bounds, and photo content. Decorative accents are local renderer assets rather than fabricated memory photos.

### Shared plans and mode changes

Templates, AI proposals, and manual edits produce the same versioned DesignPlan. The shared validator, preview, PDF renderer, source consent, final approval, receipt, and exact-byte download paths apply to both. Template editing never needs a live model. Continue manually opens the last accepted design in the same editor and preserves its assets, accepted text, and complete source/AI provenance; it does not silently reset the design or erase style-only consent dependencies.

A mode choice or operational AI toggle alone does not change frozen PDF bytes or invalidate valid final approvals. Editing accepted content or layout creates a new draft/candidate under the existing version rules. Pending or invalid model output never replaces the last accepted design.

### Disabling AI

An authorized operator can disable AI across the application without a redeploy. The server is the source of truth, defaults to disabled when configuration is absent or cannot be validated, and checks availability at request admission and immediately before dispatch. Browser controls reflect that state. Hiding a button alone is insufficient.

Disabled means no new model requests for design, refinement, transcription, visual analysis, or automated retry, including startup/background work. Cancel queued jobs and invalidate in-flight jobs so late results cannot enter the draft. A request already dispatched may finish at the processor and cannot be recalled. Re-enabling permits a fresh user-requested job under current consent; cancelled jobs do not resume automatically.

Existing accepted AI drafts remain manually editable, and valid frozen candidates/approved PDFs stay reviewable and downloadable subject to their existing permissions. The switch changes future AI availability, not source consent or download authorization. Operators cannot use it to grant processor permission on contributors' behalf. Users can also choose Template mode while AI remains enabled globally.

Both creation modes are intended product capabilities. The complete dual-mode release includes evidence that AI generation works when enabled and template creation works when disabled. The template milestone and an AI-disabled demo can be delivered independently; an AI-disabled configuration is supported operation, while an unimplemented AI mode must be described honestly.

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

The processing disclosure identifies each service and its role: transcription may receive sanitized audio; visual analysis may receive resized photos and selected video frames; design generation may receive authorized transcripts, visual summaries, selected images where disclosed, and an optional prompt. The disclosure states relevant retention behavior and the bounded derivative types. When AI is enabled, the planned demo inference services run in the team's cloud. CH-21 selects and validates the deployment and model/runtime capabilities using synthetic fixtures; CH-19 integrates transcription and CH-18 integrates visual/design inference. The team has eight H200 GPUs available and the demo is English-only. Cloud provider, model weights, serving runtime, and final processor selection remain undecided. The earlier closed-model discussion has not selected an external provider.

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
4. Choose Use a template, or Create with AI when available and authorized. In either mode inspect the six-page preview and edit content/style. Confirm manually entered or generated quotes and attribution; Continue manually preserves the last accepted AI design.
5. Freeze a candidate, collect every required final approval, and download the exact approved PDF and optional receipt.

The collection workspace shows contribution and processing status. The memory editor shows media type, limits, playback or preview, text, participants, and use scope. The approval inbox shows exact versions and distinct use decisions. The composer always shows template selection, editable pages, and manual style/content controls; when available it also shows AI inspiration, generation/refinement actions, job status, and recovery. If disabled, it explains briefly that template creation remains available. Edition review shows the complete frozen file, edition identifier, distribution notice, and approval progress. Download explains that saved copies can be forwarded.

## MVP scope and limits

The core release includes real TideCloak identity and protected release, three demo contributors, one collection of six to twelve memories, encrypted multimodal sources, explicit review and processing permissions, bounded local media preparation, independent template creation, optional-at-runtime AI design/transcription, a backend AI availability switch, shared manual editing, final edition approvals, and an offline six-page PDF.

The SRD defines enforceable formats and budgets: JPEG/PNG images; short supported audio uploads; short supported videos; bounded transcription, resized images, and sparse frame sampling. Continuous video understanding, long recordings, real-time capture, and live collaborative editing are outside scope. Uploading a voice note is sufficient; an in-app recorder is future work.

The MVP also excludes voice cloning, facial or speaker identification, fabricated memory photos, arbitrary model-generated code, public galleries, social feeds, payments, print fulfillment, professional print production, external sharing integrations, and automatic publishing. Native device saving and ordinary file sharing are sufficient.

## Self-hosted AI for the demo

For enabled AI mode, plan inference in the team's cloud behind authenticated endpoints, using a vision-capable model for visual interpretation and structured design. The application starts and the template flow works without this inference deployment. Use a separate speech-to-text model if the selected model does not support transcription. One model is not assumed to cover every modality. CH-21 records hardware fit, model licensing, pinned weights/runtime, measured latency, capacity, and reproducible start/stop instructions before processing real memories.

Approved derivatives travel to the explicitly named cloud inference service or disclosed dispatch proxy. Access requires current contributor permission as well as service authentication. Keep service credentials server-side, protect traffic with TLS, restrict endpoint access, and disable prompt/media logging, training on requests, and unintended plaintext persistence. Do not use a managed AI API as an automatic fallback. An outage leaves manual editing and explicit retry available.

The team controls the inference deployment, but the model process and sufficiently privileged cloud operators can still see submitted plaintext. Self-hosting changes the recipient and operational control; it does not remove consent requirements or prove that no administrator can see an authorized inference session. Tide governs the verified release boundary, not confidentiality inside an ordinary cloud GPU process.

## TideCloak contribution

TideCloak supplies identity and the foundation for encrypted access and administrative governance. Its guides describe governed browser encryption, quorum approval for identity and permission changes, and Forseti validation of protected operations. [Encryption guide](https://docs.tide.org/Admin/e2ee), [QEA guide](https://docs.tide.org/Core-Concepts/iga-workflow), [Forseti guide](https://docs.tide.org/Core-Concepts/forseti-engine).

Chorus must implement the distinct requirement that every declared approver consents to an exact version and use. Administrative quorum does not replace contributor consent. A self-encryption example does not establish cross-user sharing or processor-scoped release.

The first integration milestone proves cross-user review and protected release on one encrypted memory, then verifies processor-recipient binding, withdrawal, and receipt feasibility. These remain integration obligations until demonstrated. Hiding a button while plaintext remains accessible to an unauthorized backend does not satisfy them.

## Success measures and demonstration

First demonstrate three contributors completing a six-page photozine from a template with AI disabled, no inference credentials/service, manually reviewed audio excerpts, and locally selected video stills. Inspect dispatch/network evidence showing no AI requests. Show that direct or stale AI calls are denied by the backend while ordinary approval and download remain available.

Separately verify enabled AI mode on authorized synthetic memories: generate without a style prompt, produce two visibly different directions across contrasting collections, refine by text, then continue editing the accepted design manually. Disable AI during queued/in-flight work, show cancelled/stale results cannot overwrite it, and confirm existing valid candidates/downloads keep working. Record enabled-mode evidence independently if the live presentation runs with AI off.

The demo must also show a missing approval blocking a direct protected request, one administrator unable to grant access alone, a blocked memory absent from processor inputs and all derivatives, final contributor approval, an exact-byte PDF download, and offline viewing. A subsequent edit requires fresh approval. A disabled, failed, or declined AI request leaves template creation and manual editing usable without contacting another provider.

Use synthetic or explicitly authorized media. Describe working protections, provider exposure, mocks, and unmet requirements accurately. Provisional usability targets remain a ten-minute creation session excluding contributor waiting, and a thirty-second PDF render on the documented device. Media preparation and AI latency are measured separately.

## Delivery order

1. Continue CH-01 unchanged. Prove the protected review, release, withdrawal, and signing integration in CH-02.
2. Define the shared plan contract in CH-20; add server availability/job gating in CH-22 after immutable configuration records. Build multimedia uploads/local derivative selection and the source-consent UI.
3. Deliver CH-09 template creation → CH-10 shared PDF freeze → CH-11/12/13 final approval, receipt, and download without depending on CH-18, CH-19, or CH-21. Finish the template/off-state verification and demo checklist.
4. In parallel, establish optional cloud inference in CH-21, integrate authorized AI derivatives in CH-19, and add generation/refinement and shared-editor handoff in CH-18. Complete enabled-mode and cross-mode evidence before claiming the full dual-mode release.

The [backlog](backlog.md) provides dependencies and parallel groups. If a gate fails, identify whether the template milestone or full dual-mode release is affected; do not present simulated consent or unimplemented AI as completed work.
