# CH-10 PDF renderer

`src/lib/render/` turns one validated `DesignPlan` (see [design-plan-contract.md](design-plan-contract.md)) into the exact PDF bytes of a candidate. Template, manual and AI plans use the same engine. The module is framework-free and alias-free, uses [pdf-lib](https://pdf-lib.js.org) 1.17.1 with `@pdf-lib/fontkit` 1.1.1 (both pinned exactly), and runs in the browser and in Node. This slice covers rendering only; the freeze UI and Convex wiring come next (see below).

## API

```ts
import { renderPlanPdf, RENDERER_VERSION, RenderError } from "@/lib/render";

const { bytes, digest, rendererVersion, fontVersions } = await renderPlanPdf(
  plan, // DesignPlan, e.g. commitPlan(...).plan
  assets, // ReadonlyMap<refKey, { bytes: Uint8Array; mimeType: "image/jpeg" | "image/png" }>
  { context, credits, editionId }, // all optional
);
```

| Input / output      | Meaning                                                                                                                                                                                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `assets`            | Locally decrypted images keyed by `refKey(ref)` (`version:<id>` / `derivative:<id>`). Every image ref placed on a page must be present. Entries the plan does not place are ignored and never embedded. Pass normalized, resized stills; video frames must already be stills.                                                                      |
| `options.context`   | The `ValidationContext` (minus `allowEmptySlots`) the freeze step gave `commitPlan`: backend-authorized refs and people. Without it, only the refs present in `assets` are authorized and no people check runs, so plans with recording text sources or style-only refs fail `UNKNOWN_ASSET`. Supplying bytes never authorizes anything by itself. |
| `options.credits`   | `creditId` → display name printed in attributions. Required for every credited text (`MISSING_CREDIT`). The plan only holds opaque IDs; the PDF never prints them.                                                                                                                                                                                 |
| `options.editionId` | Optional `[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}` written to the PDF Subject as `Chorus edition <id>` (FR-25).                                                                                                                                                                                                                                          |
| `bytes`, `digest`   | The PDF and its lowercase SHA-256 hex (`pdfDigest` for `appendCandidate`).                                                                                                                                                                                                                                                                         |
| `rendererVersion`   | `RENDERER_VERSION`, currently `chorus-pdf/1.0.0 (chorus-components/v1; pdf-lib 1.17.1; @pdf-lib/fontkit 1.1.1)`.                                                                                                                                                                                                                                   |
| `fontVersions`      | Sorted, one entry per embedded font: `PostScriptName@version+sha256:<ttf digest>`, e.g. `CrimsonText-Regular@1.100+sha256:48e6…1f06`. Only fonts the plan actually uses are embedded and listed. The list satisfies `stringSet` in the manifest.                                                                                                   |

Failures throw `RenderError` with a `code`; nothing partial is returned, so a failed render can never become a candidate.

| Code                    | Cause                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `INVALID_PLAN`          | `validatePlan` failed (saving rules: no empty slots). `planErrors` holds the contract error codes and paths.        |
| `MISSING_ASSET`         | A placed image ref has no entry in `assets`; the message lists every missing ref.                                   |
| `INVALID_ASSET`         | Bytes are not the declared JPEG/PNG, or cannot be decoded.                                                          |
| `MISSING_CREDIT`        | A credited text has no display name.                                                                                |
| `UNSUPPORTED_CHARACTER` | A code point the pinned font cannot draw (emoji, CJK, Arabic, Hebrew…). The message names the component and U+code. |
| `TEXT_OVERFLOW`         | Text does not fit its frame even at half the nominal size.                                                          |
| `FONT_INTEGRITY`        | A vendored font module does not match its pinned SHA-256.                                                           |

## What it draws

- **Pages.** Six 148 × 210 mm pages (419.528 × 595.276 pt), portrait, no rotation, in plan order. Each page is filled with `paper`. Pages 2–6 get a small page number in the body font. Components paint in array order inside their `frame`; `layout` is ignored.
- **Images.** `image`, `grid` and `collage` assets are cover-cropped into their frame and clipped to it. A grid uses 1, 2 or 3 columns for 1, ≤4 or ≤6 assets. A collage draws up to four tilted white prints (−6°, 4°, −2°, 7°) clipped to the frame. Each asset is embedded once, however often it is placed.
- **Text.** Cover titles and headings use the heading font in `accent`; `grotesk` headings are uppercased, as in the prototype. Quotes use the quote face in `ink` with a large accent “ mark. Captions use the body italic; notes use the body regular. Quotes, captions and notes with a `creditId` end with `— Name` (`— Name, m:ss` for a recording excerpt) in the body font at 80 %. `muted` is used only for decoration (tape, film border).
- **Cover.** The image fills the frame above the title; the title sits at the bottom and the image gives up space when a long title needs it.
- **Sizing.** Text starts at `TYPE_SIZE_MM` with a 1.25 line height and shrinks by 5 % steps until it fits the frame, never below 50 % (`TEXT_OVERFLOW`). Nothing is clipped (NFR-03). Lines break at spaces; runs of spaces collapse; a word wider than the line breaks between characters; `\n` starts a new line.
- **Textures.** `film` strokes a `muted` border inset 3 %. `grain` draws a fixed speckle pattern behind the components. `tape` adds a tilted strip on images and the cover.
- **Metadata.** Title = cover text; Creator `Chorus`; Producer = `RENDERER_VERSION`; CreationDate/ModDate = `RENDERER_EPOCH` (2026-10-22T00:00:00Z); optional Subject. No Author, no XMP, no trailer `/ID`.

Text is drawn literally with `drawText`: nothing in a plan is parsed as markup, and the renderer never calls `fetch`. Fonts come from bundled modules (in the browser, the app's own lazily loaded script chunks, never a plan-controlled URL), and images only from `assets`. JPEG bytes are embedded as-is by pdf-lib, so the renderer first strips APP1–APP13, APP15 and COM segments (EXIF/GPS, XMP, ICC, comments) and keeps only the segments needed for decoding, including between progressive scans; everything after the end-of-image marker (multi-picture EXIF, gain maps, motion-photo video) is dropped, and a JPEG without one is rejected. PNGs over 24 megapixels are rejected before decoding. PNGs are decoded and re-encoded, so their text chunks never reach the PDF.

## Determinism

Identical plan, assets (by content; map order is irrelevant), options and `RENDERER_VERSION` give byte-identical PDFs. The tests check this and pin the two fixtures' digests. The same digests came out of separate Node processes and of an esbuild browser bundle (code-split font chunks) in headless Chrome 155. The rules:

- Fixed CreationDate/ModDate/Producer/Creator, `updateMetadata: false` and no trailer `/ID`.
- pdf-lib's only randomness (font subset and resource name suffixes) comes from a PRNG seeded with a constant, but that PRNG uses `Math.sin`, so those names are only proven identical in V8 (Node and Chrome); other engines are untested. Frozen bytes are stored, so this never changes an issued edition. Fonts and images embed in first-use order, which follows the plan.
- `save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false })`: classic cross-reference table, stable object order.
- Geometry uses only `+ − × ÷`, rounded to 0.001 pt. Tilts use literal cos/sin constants instead of `Math.cos`/`Math.sin`, whose last bits differ between JavaScript engines. The grain pattern uses an integer PRNG.
- Text is NFC-normalized before measuring and drawing.
- Fonts are pinned by SHA-256 and checked on every load.

The same plan should therefore produce the same bytes in V8, SpiderMonkey and JavaScriptCore. Only V8 (Node and Chrome) has been tested so far. This doesn't affect consent: CH-10 freezes the bytes it rendered and never renders again, so later receipts and downloads verify those stored bytes, not a re-render. Bump `RENDERER_VERSION` for any change that can alter output, including upgrading pdf-lib or fontkit.

## Fonts

Nine OFL 1.1 TTFs from google/fonts are vendored as base64 modules in `src/lib/render/fonts/data/`. Their source commit, versions, sizes and SHA-256 are in [src/lib/render/fonts/README.md](../src/lib/render/fonts/README.md) and `fonts.json`, with license texts beside them. Each font is a lazily imported chunk, so a plan loads only what it uses. All fonts are embedded as subsetted CID TrueType fonts with ToUnicode maps, so text stays selectable. No standard-14 (non-embedded) fonts are used.

| Token             | Face                                            |
| ----------------- | ----------------------------------------------- |
| heading `serif`   | Crimson Text SemiBold                           |
| heading `hand`    | Patrick Hand                                    |
| heading `grotesk` | Barlow Condensed ExtraBold (quotes: Medium)     |
| heading `mono`    | IBM Plex Mono SemiBold                          |
| body `serif`      | Crimson Text Regular / Italic (quotes: Regular) |
| body `sans`       | Barlow Regular / Italic                         |

`node scripts/vendor-fonts.mjs` downloads the files again and fails on any digest change. See the fonts README to add a font.

## Freeze step (rest of CH-10)

1. `commitPlan(draft, context)` with the backend's current `authorizedAssets` and `people`, without `allowEmptySlots`. Stop on errors. If the draft is not yet saved, save it through `appendPlan` with the returned bytes and digest.
2. Decrypt every placed image ref locally, as an authorized client, into the `assets` map. Build `credits` from collection members.
3. `renderPlanPdf(commit.plan, assets, { context, credits })`. Show `RenderError` codes as actionable messages (NFR-09) and create nothing on failure. Measure and record render time on the demo device (NFR-04). Each fixture renders in about 150–200 ms in Node on a dev machine.
4. Call `prepareManifest({ collectionId, planId, rendererVersion, fontVersions, recipientId, reviewAudienceIds, downloadAudienceIds, distributionScope })` to get the canonical manifest and its digest. `manifestBytes(manifest)` gives the exact bytes.
5. Encrypt the PDF bytes and the manifest bytes for the review audience, store both as `privatePayloads` with their ciphertext digests, and keep the plaintext digests: `digest` from the renderer and the manifest digest.
6. `appendCandidate({ ...manifestArgs, pdfPayloadId, pdfDigest: digest, manifestPayloadId, manifestDigest })`. The server rebuilds the manifest and rejects a digest mismatch.
7. Never render again: review (CH-11) and download (CH-13) decrypt the stored bytes and check `sha256 === pdfDigest`.

## Limits

- **Shaping.** fontkit applies GSUB substitutions (ligatures), but pdf-lib places glyphs by advance width only. Kerning and GPOS mark positioning are ignored, so combining marks that do not compose under NFC sit badly. There is no hyphenation or justification.
- **Emoji, CJK and other scripts.** Characters missing from the pinned fonts fail with `UNSUPPORTED_CHARACTER` instead of drawing empty boxes. The editor should warn before freeze.
- **RTL.** There is no bidi reordering or Arabic shaping; such text is rejected by the glyph check, and would still render wrongly if a font covered it.
- **Accessibility and archiving.** Text is selectable but the PDF is untagged (not PDF/UA) and not PDF/A (no OutputIntent or XMP). Colors are DeviceRGB.
- **Images.** JPEG and PNG only, embedded at the supplied resolution. The caller must pass resized derivatives to keep files small. Stills from video must already be extracted.
- **Determinism in Firefox and Safari** is designed for but not yet tested (see above).
