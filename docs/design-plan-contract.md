# CH-20 DesignPlan contract

One versioned plan shape for template, manual and AI designs (FR-15, FR-29 to FR-31, FR-33). The composer (CH-09), structured AI output (CH-18) and the PDF freeze (CH-10) all use `src/lib/design-plan/`. It is framework-free and imports nothing through `@/`, so Next and Convex share it (`convex/model/plans.ts` imports it relatively). A plan is data for pinned local components, never markup, code or fetch instructions.

## Versions

| Constant                 | Value                  | Meaning                                                                                                        |
| ------------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| `PLAN_SCHEMA_VERSION`    | `chorus-plan/v1`       | Plan body shape. Bump on any change to a field's shape or meaning.                                             |
| `PLAN_COMPONENT_VERSION` | `chorus-components/v1` | Component set and behaviour the plan targets. CH-10 maps it to pinned renderer and font versions per manifest. |

`SUPPORTED_SCHEMA_VERSIONS` and `SUPPORTED_COMPONENT_VERSIONS` list what the validator and `appendPlan` accept; old versions stay listed while plans using them must still render. Template presets carry `templateId` + `templateVersion`; a published version is immutable, so a changed preset is a new version.

## Shape

```
DesignPlan
  schemaVersion, componentVersion
  provenance   { creationOrigin, revisionOrigin, parentDigest?, aiJobs[] }
  style        { name, paper, ink, accent, muted, headingFont, bodyFont, texture }
  pages[6]     { role, layout, widthMm: 148, heightMm: 210, components[1..8] }
  influence    { visible[], style[] }
  inspiration? { rationale, prompt? }
```

- **Pages.** Exactly six portrait A5 pages. Geometry is whole millimetres from the top left. The roles run in a fixed order: cover, opening, photos, perspectives, more, closing. `layout` (full, split, grid, collage, stack) is a preview hint; `frame` is what the renderer uses. Components paint in array order.
- **Components.** `cover` (≤1 asset + title), `image` (≤1 asset), `grid` (≤6), `collage` (≤4), and the text components `heading`, `quote`, `caption`, `note`. Each has a unique `id` and a `frame {x,y,w,h}` that fits inside the page and is at least 8 mm each way. Frames may overlap, but a later component may not cover an earlier text-bearing one (text or cover). Text painted over an earlier image is allowed.
- **Assets.** `AssetRef = { kind: "version" | "derivative", id }`: an opaque memory-version or derived-artifact ID (still, resized image, reviewed excerpt). Never a URL or path. The renderer resolves refs only from locally decrypted, authorized assets.
- **Text.** `PlanText = { value, creditId?, authored?: true, source? }`. `source = { asset, startMs?, endMs? }` holds the words' source and, for recordings, the excerpt range. `authored` marks new words written while editing; the credited person joins the final approvers. Quotes and excerpts need a `creditId`.
- **Style.** Colors are lowercase `#rrggbb`; `#rgb` is rejected so one color has one encoding. `contrastRatio` reads `#rgb` only for live editor feedback. Heading fonts: serif, hand, grotesk, mono. Body fonts: serif, sans. Textures: none, film, tape, grain. `muted` is decoration only, never text.
- **Influence closure.** `visible` is exactly the set of refs placed on pages, including text sources. `style` holds refs that shaped the plan without appearing: style-only AI inputs and retained influence from earlier revisions. A ref appears once.
- **Provenance.** Origins match `convex/model/validators.ts` `origin`: `template {templateId, templateVersion}`, `ai {jobId, modelVersion}` or `manual`. `creationOrigin` is the root and never changes. `aiJobs` lists every AI design job in the plan's ancestry and is empty without AI. `parentDigest` is the parent revision's content digest.

## Validation

`validatePlan(input: unknown, context)` returns `{ ok: true, plan }` or `{ ok: false, errors: { code, path, message }[] }`. It is pure and deterministic, and it collects up to 100 errors. `context` holds:

- `authorizedAssets`: refs the editor may use now, meaning currently approved source versions and derivatives returned by the authorized backend. Fixtures and the validator never grant access.
- `people` (optional): IDs that may be credited.
- `allowEmptySlots` (optional): drafts may keep unfilled slots and blank pages; saving for freeze must not.

| Code                                  | Rejects                                                                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `MALFORMED`                           | Wrong type, missing field, explicit `undefined`, non-plain object; over 20,000 nodes, 12 levels or 256 Ki UTF-16 units of strings        |
| `UNKNOWN_FIELD`                       | Any field outside the schema, including operational flags such as `editingMode` or `aiEnabled`                                           |
| `UNSUPPORTED_SCHEMA_VERSION`          | `schemaVersion` not supported                                                                                                            |
| `UNSUPPORTED_COMPONENT_VERSION`       | `componentVersion` not supported                                                                                                         |
| `PAGE_COUNT`                          | Not exactly six pages                                                                                                                    |
| `PAGE_FORMAT`                         | Page not 148 × 210 mm (landscape, other sizes)                                                                                           |
| `PAGE_ORDER`                          | Roles out of order or repeated                                                                                                           |
| `UNKNOWN_PAGE_ROLE`, `UNKNOWN_LAYOUT` | Role or layout not allowlisted                                                                                                           |
| `UNKNOWN_COMPONENT`                   | Component kind not allowlisted                                                                                                           |
| `UNKNOWN_FONT`, `UNKNOWN_TEXTURE`     | Font or texture not allowlisted                                                                                                          |
| `INVALID_COLOR`                       | Color not lowercase `#rrggbb`                                                                                                            |
| `LOW_CONTRAST`                        | Ink on paper below 4.5:1 (WCAG 2.2 AA body text); accent on paper below 3:1 (AA large text; accent is used only at display sizes ≥ 8 mm) |
| `UNSAFE_MARKUP`                       | HTML/XML tags, entities, `${`, `{{`, `javascript:`, inline `on…=` handlers or `url(` in **any** string                                   |
| `EXTERNAL_URL`                        | `scheme://`, `//host.tld`, `www.host.` or `data:`/`blob:`/`file:`/`javascript:`/`mailto:`/`tel:`/`ftp:` URLs in any string               |
| `CONTROL_CHARACTER`                   | C0/C1 controls other than newline; zero-width, direction, line/paragraph separator and tag characters; BOM; unpaired surrogates          |
| `INVALID_ID`, `DUPLICATE_ID`          | IDs outside `[A-Za-z0-9][A-Za-z0-9_.-]{0,63}`; repeated component IDs                                                                    |
| `INVALID_BOUNDS`                      | Frame missing, fractional, negative, smaller than 8 mm or outside the page                                                               |
| `FRAME_OVERLAP`                       | A frame covering an earlier text or cover frame on the same page                                                                         |
| `COMPONENT_LIMIT`                     | More than eight components on a page                                                                                                     |
| `COMPONENT_CONTENT`                   | Too many or duplicate assets in a component                                                                                              |
| `EMPTY_SLOT`                          | Blank text, an empty asset slot or a blank page, unless `allowEmptySlots`                                                                |
| `TEXT_OVERFLOW`                       | Over the code-point limit, over the frame's estimated capacity (below), or any string over 4,000 UTF-16 units                            |
| `INVALID_TIME_RANGE`                  | Excerpt range not `0 ≤ startMs < endMs` integers                                                                                         |
| `ATTRIBUTION_REQUIRED`                | Quote or recording excerpt without `creditId`                                                                                            |
| `UNKNOWN_PERSON`                      | `creditId` outside `context.people`                                                                                                      |
| `UNKNOWN_ASSET`                       | Placed or style-only ref missing from `context.authorizedAssets`                                                                         |
| `INFLUENCE_MISSING`                   | Placed ref missing from `influence.visible`                                                                                              |
| `CLOSURE_INVALID`                     | Duplicate closure ref, or a `visible` ref that is not placed (move it to `style`)                                                        |
| `UNKNOWN_TEMPLATE`                    | Template origin that is not a published `templateId` + `templateVersion`                                                                 |
| `INVALID_PROVENANCE`                  | Malformed origin, AI origin missing from `aiJobs`, duplicate job, malformed `parentDigest`                                               |

String checks run in a fixed order. First come the size caps: per string, then the whole plan. Over-long strings are rejected without pattern matching. The patterns then run on the NFKC form, so fullwidth `ｈｔｔｐｓ：／／` and `＜script＞` match as well, and every pattern runs in linear time.

Text limits are in Unicode code points and reuse the SRD limits: cover and heading 80 (title), caption and quote 240 (caption), note 2,000 (story). Capacity is estimated at the nominal type size (cover 12 mm, heading 8, quote 5.5, caption 4, note 3.5) with half-em glyphs and a 1.25 line height. Newlines and U+2028/U+2029 start new lines. `layoutFrames` first reserves each text frame the height that its longest single-paragraph text needs, then gives the rest to photos. Every template therefore holds text up to these limits. Many short paragraphs can still overflow. The renderer may set text smaller, never larger, and must still check that nothing is clipped (NFR-03). Source text and media are untrusted data. The validator does not interpret instructions inside them, and nothing in a plan can trigger a fetch.

## Revisions, lineage and commitments

- **Canonical bytes.** `planBytes(plan)` is UTF-8 `canonicalJson` from `src/lib/consent/manifest.ts` (sorted keys, no undefined). It covers schema fields only, so unknown or undefined fields never reach the bytes. Closure refs sort by `kind:id` and `aiJobs` by `jobId`, so set order never changes the bytes; page and component order are content. `planDigest(plan)` is SHA-256 of those bytes and is the `contentDigest` passed to `appendPlan`.
- **Freeze input.** `commitPlan(input, context)` validates, then returns `{ plan, bytes, digest }`. Encrypt exactly `bytes` into the plan's `privatePayloads` row. Plan bodies, prompts and text never go on routing records.
- **Immutable revisions.** Every accepted change is a new plan with a new digest; parents are never edited. `reviseManually(parent, { pages?, style?, inspiration? })` is the manual edit and Continue manually helper. It keeps `creationOrigin` and `aiJobs`, sets `revisionOrigin: manual` and `parentDigest`, and recomputes the closure so that refs no longer placed move to `style`. The validator sees one plan at a time, so it cannot tell when a child drops its parent's style refs. Influence grows along a lineage only for revisions built with `reviseManually` (the prototype's save does the same). The consent guarantee comes from the server: `appendPlan` unions the parent's recorded lineage, so a dropped ref still requires its approvers. To drop a withdrawn source, start a new root plan (see `docs/immutable-consent-model.md`).
- **Operational flags.** AI on/off, editing mode and job state are not plan content. They are rejected as unknown fields, so they cannot change a plan digest, a PDF or approvals. Switching modes without editing creates no revision.
- **Server checks.** `plans.appendPlan` receives ciphertext and cannot run the validator. It rejects unsupported `schemaVersion`/`componentVersion` (`UNSUPPORTED_SCHEMA_VERSION`, `UNSUPPORTED_COMPONENT_VERSION`) and unpublished template origins (`UNKNOWN_TEMPLATE`). It checks AI job provenance and approval of every source, then unions parent, source, derivative and job lineage. The client runs `validatePlan` before saving and again before freezing. The `sourceUses`/`derivativeIds` sent with a save must cover `influence.visible` (as `visible`/`both`) and `influence.style` (as `style`). The plan's workflow projection gets `editingMode: "ai"` for AI revisions and `"template"` for template and manual revisions; the schema has no third mode.

## Consumer interfaces

- **CH-09 preview/editor.** Build drafts with `buildTemplatePlan(templateId, content, { idPrefix })`, which is deterministic and needs no model or AI consent. Edit via `reviseManually`. Validate with `allowEmptySlots: true` for live preview and without it before save. Render only allowlisted components from local assets; `layoutFrames(layout, kinds)` gives the default geometry. The prototype adapts its UI plan with `src/features/prototype/contract.ts` (memory IDs stand in for version IDs; collection members are `people`) and shows the result as the composer's "contract" check, naming the failing page and block. The inspector's character counters use `TEXT_LIMITS`.
- **CH-18 structured output.** The model returns one `DesignPlan` JSON with `creationOrigin`/`revisionOrigin` `ai`, the job in `aiJobs`, a complete closure covering style-only inputs, and an optional `inspiration`. Accept it only if `validatePlan` passes against the job's authorized inputs. On failure, keep the prior accepted draft (FR-29). Refinements are new revisions with `parentDigest` and the inherited `aiJobs`.
- **CH-10 freeze.** Freeze only `commitPlan(...).ok` output. The manifest's `plan.digest` is that digest, and `schemaVersion`/`componentVersion`/origins come from the plan. Render with one engine for every origin; record `rendererVersion` and `fontVersions` for the component version. Hash and keep the exact PDF bytes; never rerender a frozen candidate.

## Fixtures and tests

`tests/fixtures/design-plans/plans.ts` holds two synthetic AI-shaped plans, warm scrapbook and bold editorial. They differ in palette, fonts, frames, page composition and component mix, and both are six A5 pages. `adversarial.ts` derives one invalid plan per rejection rule. `tests/design-plan.test.ts` covers the acceptance criteria. `src/features/prototype/contract.test.ts` checks that every seed and template plan in the prototype passes the contract. `tests/plans.test.ts` covers the server version, template and editing-mode checks. All fixtures are synthetic and need no credentials or collection APIs.

Deferred: the CH-10 renderer and font pinning, the CH-09 Convex wiring and encryption of plan payloads, and the CH-18 schema prompt/decoder.
