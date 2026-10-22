import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  MousePointerClick,
  XCircle,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { stylePresets } from "@/features/prototype/store";
import {
  formatDuration,
  LIMITS,
  manualEligible,
} from "@/features/prototype/selectors";
import type {
  Block,
  Memory,
  Person,
  StyleTokens,
} from "@/features/prototype/types";
import { codePoints, contrastRatio, type ValidationRow } from "./plan-utils";

const textKinds: Block["kind"][] = [
  "cover",
  "heading",
  "note",
  "caption",
  "quote",
];
const imageKinds: Block["kind"][] = ["cover", "image"];
const multiImageKinds: Block["kind"][] = ["grid", "collage"];
const attributedKinds: Block["kind"][] = ["note", "caption", "quote"];

const kindLabel: Record<Block["kind"], string> = {
  cover: "Cover",
  heading: "Heading",
  image: "Image",
  grid: "Photo grid",
  collage: "Collage",
  quote: "Quote",
  caption: "Caption",
  note: "Note",
};

function limitFor(kind: Block["kind"]) {
  if (kind === "caption") return LIMITS.captionChars;
  if (kind === "note") return LIMITS.storyChars;
  if (kind === "cover") return LIMITS.titleChars;
  return LIMITS.captionChars;
}

export function BlockInspector({
  block,
  memories,
  people,
  collectionId,
  onChange,
}: {
  block?: Block;
  memories: Memory[];
  people: Person[];
  collectionId: string;
  onChange: (block: Block) => void;
}) {
  if (!block)
    return (
      <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-xs leading-relaxed text-muted-foreground">
        <MousePointerClick
          className="mt-0.5 size-3.5 shrink-0"
          aria-hidden="true"
        />
        Select a block on the page to edit its text, attribution, or photo.
      </div>
    );

  const visuals = memories.filter(
    (m) =>
      manualEligible(m) && m.art && (m.kind === "photo" || m.kind === "video"),
  );
  const sourceId = block.memoryIds?.[0];
  const source = memories.find((m) => m.id === sourceId);
  const excerpt = source?.transcript?.find((e) => e.id === block.excerptId);
  const limit = limitFor(block.kind);
  const length = codePoints(block.text);
  const edit = (patch: Partial<Block>) =>
    onChange({ ...block, ...patch, edited: true });

  return (
    <section aria-labelledby="inspector-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 id="inspector-heading" className="text-sm font-semibold">
          {kindLabel[block.kind]} block
        </h3>
        {block.edited && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
            Edited · needs final review
          </span>
        )}
      </div>

      {textKinds.includes(block.kind) && (
        <div className="space-y-1.5">
          <Label htmlFor="block-text" className="text-xs">
            {block.kind === "quote" ? "Quote wording" : "Text"}
          </Label>
          <Textarea
            id="block-text"
            value={block.text ?? ""}
            rows={block.kind === "note" ? 5 : 3}
            onChange={(e) => edit({ text: e.target.value })}
            aria-invalid={length > limit}
            aria-describedby="block-text-count"
          />
          <p
            id="block-text-count"
            className={cn(
              "text-[11px] text-muted-foreground tabular-nums",
              length > limit && "font-medium text-[var(--status-excluded)]",
            )}
          >
            {length} / {limit.toLocaleString()}
            {length > limit && " — over the limit"}
          </p>
          {block.kind === "quote" && excerpt && block.text !== excerpt.text && (
            <p className="flex gap-1.5 text-[11px] leading-relaxed text-[var(--status-awaiting)]">
              <AlertTriangle
                className="mt-0.5 size-3 shrink-0"
                aria-hidden="true"
              />
              The wording no longer matches the reviewed transcript. If this
              changes the meaning, correct the transcript on the memory instead;
              the speaker must approve the change.
            </p>
          )}
        </div>
      )}

      {attributedKinds.includes(block.kind) && (
        <div className="space-y-1.5">
          <Label htmlFor="block-attribution" className="text-xs">
            Attribution
          </Label>
          <Select
            value={block.attributionId ?? "none"}
            onValueChange={(v) =>
              edit({ attributionId: v === "none" ? undefined : v })
            }
          >
            <SelectTrigger id="block-attribution" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No attribution</SelectItem>
              {people.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            New attributed text adds that person as a final approver.
          </p>
        </div>
      )}

      {imageKinds.includes(block.kind) && (
        <div className="space-y-1.5">
          <Label htmlFor="block-image" className="text-xs">
            Photo or video still
          </Label>
          <Select
            value={sourceId ?? ""}
            onValueChange={(id) =>
              edit({ memoryIds: [id], stillIds: undefined })
            }
          >
            <SelectTrigger id="block-image" className="w-full">
              <SelectValue placeholder="Choose an approved memory" />
            </SelectTrigger>
            <SelectContent>
              {visuals.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {source?.kind === "video" && (
            <>
              <Label htmlFor="block-still" className="text-xs">
                Still from the clip
              </Label>
              <Select
                value={block.stillIds?.[0] ?? ""}
                onValueChange={(id) => edit({ stillIds: [id] })}
              >
                <SelectTrigger id="block-still" className="w-full">
                  <SelectValue placeholder="First selected still" />
                </SelectTrigger>
                <SelectContent>
                  {(source.stills ?? [])
                    .filter((s) => s.selected)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        Still at {formatDuration(s.atSec)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </>
          )}
          <p className="text-[11px] text-muted-foreground">
            Only memories approved for you as editor are listed, including
            manual-only memories.
          </p>
        </div>
      )}

      {multiImageKinds.includes(block.kind) && (
        <fieldset className="space-y-1.5">
          <legend className="mb-1 text-xs font-medium">Photos (up to 4)</legend>
          {visuals.map((m) => {
            const checked = block.memoryIds?.includes(m.id) ?? false;
            const full = (block.memoryIds?.length ?? 0) >= 4;
            return (
              <label key={m.id} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={checked}
                  disabled={!checked && full}
                  onCheckedChange={(value) =>
                    edit({
                      memoryIds: value
                        ? [...(block.memoryIds ?? []), m.id]
                        : (block.memoryIds ?? []).filter((id) => id !== m.id),
                    })
                  }
                />
                {m.title}
              </label>
            );
          })}
        </fieldset>
      )}

      {block.kind === "quote" && (
        <div className="space-y-1 rounded-lg border bg-card p-3 text-xs">
          <p className="font-medium">Provenance</p>
          {source && excerpt ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
              <dt>Source</dt>
              <dd className="text-foreground">
                {source.title} · v{source.version}
              </dd>
              <dt>Excerpt</dt>
              <dd className="text-foreground">
                {formatDuration(excerpt.startSec)}–
                {formatDuration(excerpt.endSec)}
              </dd>
              <dt>Speaker</dt>
              <dd className="text-foreground">
                {people.find((p) => p.id === excerpt.speakerId)?.name ??
                  "Unknown"}{" "}
                (declared)
              </dd>
              <dt>Review</dt>
              <dd
                className={cn(
                  "inline-flex items-center gap-1",
                  excerpt.reviewed
                    ? "text-[var(--status-available)]"
                    : "text-[var(--status-awaiting)]",
                )}
              >
                {excerpt.reviewed ? (
                  <CheckCircle2 className="size-3" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="size-3" aria-hidden="true" />
                )}
                {excerpt.reviewed ? "Reviewed" : "Not reviewed yet"}
              </dd>
            </dl>
          ) : (
            <p className="text-muted-foreground">
              {source
                ? `From the caption of “${source.title}”, not a transcript.`
                : "No source memory. Written in the editor."}
            </p>
          )}
          {source && (
            <Link
              to="/collections/$collectionId/memories/$memoryId"
              params={{ collectionId, memoryId: source.id }}
              className="inline-block pt-1 text-primary underline underline-offset-2"
            >
              Review transcript and attribution
            </Link>
          )}
        </div>
      )}
    </section>
  );
}

const fontOptions: { value: StyleTokens["headingFont"]; label: string }[] = [
  { value: "serif", label: "Book serif" },
  { value: "hand", label: "Handwritten" },
  { value: "grotesk", label: "Condensed grotesk" },
  { value: "mono", label: "Typewriter mono" },
];

function ColorField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
        />
        <Input
          aria-label={`${label} hex value`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 font-mono text-xs"
        />
      </div>
    </div>
  );
}

export function StyleControls({
  tokens,
  onChange,
}: {
  tokens: StyleTokens;
  onChange: (tokens: StyleTokens) => void;
}) {
  const ratio = contrastRatio(tokens.ink, tokens.paper);
  const presetKey = Object.entries(stylePresets).find(
    ([, preset]) => preset.name === tokens.name,
  )?.[0];
  const set = (patch: Partial<StyleTokens>) =>
    onChange({
      ...tokens,
      ...patch,
      name: patch.name ?? `${tokens.name.replace(/ \(edited\)$/, "")} (edited)`,
    });
  return (
    <section aria-labelledby="style-heading" className="space-y-3">
      <h3 id="style-heading" className="text-sm font-semibold">
        Style
      </h3>
      <div className="space-y-1">
        <Label htmlFor="style-preset" className="text-xs">
          Starting point
        </Label>
        <Select
          value={presetKey ?? "custom"}
          onValueChange={(key) => {
            const preset = stylePresets[key];
            if (preset) onChange({ ...preset });
          }}
        >
          <SelectTrigger id="style-preset" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {!presetKey && (
              <SelectItem value="custom">{tokens.name}</SelectItem>
            )}
            {Object.entries(stylePresets).map(([key, preset]) => (
              <SelectItem key={key} value={key}>
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-1 gap-2">
        <ColorField
          id="color-paper"
          label="Paper"
          value={tokens.paper}
          onChange={(paper) => set({ paper })}
        />
        <ColorField
          id="color-ink"
          label="Ink"
          value={tokens.ink}
          onChange={(ink) => set({ ink })}
        />
        <ColorField
          id="color-accent"
          label="Accent"
          value={tokens.accent}
          onChange={(accent) => set({ accent })}
        />
      </div>
      <p
        className={cn(
          "text-[11px]",
          ratio >= 4.5
            ? "text-muted-foreground"
            : "font-medium text-[var(--status-excluded)]",
        )}
      >
        Text contrast {ratio.toFixed(1)}:1{" "}
        {ratio >= 4.5 ? "(readable)" : "(too low, minimum 4.5:1)"}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="font-heading" className="text-xs">
            Headings
          </Label>
          <Select
            value={tokens.headingFont}
            onValueChange={(v) =>
              set({ headingFont: v as StyleTokens["headingFont"] })
            }
          >
            <SelectTrigger id="font-heading" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fontOptions.map((f) => (
                <SelectItem key={f.value} value={f.value}>
                  {f.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="font-body" className="text-xs">
            Body
          </Label>
          <Select
            value={tokens.bodyFont}
            onValueChange={(v) =>
              set({ bodyFont: v as StyleTokens["bodyFont"] })
            }
          >
            <SelectTrigger id="font-body" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="serif">Book serif</SelectItem>
              <SelectItem value="sans">Sans</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Fonts and textures are bundled renderer assets. Plans cannot load
        external fonts or images.
      </p>
    </section>
  );
}

export function ValidationList({ rows }: { rows: ValidationRow[] }) {
  const failing = rows.filter((r) => !r.ok).length;
  return (
    <section aria-labelledby="validation-heading" className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 id="validation-heading" className="text-sm font-semibold">
          Plan checks
        </h3>
        <span
          className={cn(
            "text-xs font-medium",
            failing
              ? "text-[var(--status-excluded)]"
              : "text-[var(--status-available)]",
          )}
        >
          {failing ? `${failing} failing` : "All passing"}
        </span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li key={row.id} className="flex gap-2 text-xs">
            {row.ok ? (
              <CheckCircle2
                className="mt-0.5 size-3.5 shrink-0 text-[var(--status-available)]"
                aria-hidden="true"
              />
            ) : (
              <XCircle
                className="mt-0.5 size-3.5 shrink-0 text-[var(--status-excluded)]"
                aria-hidden="true"
              />
            )}
            <span>
              <span className="font-medium">
                <span className="sr-only">{row.ok ? "Pass: " : "Fail: "}</span>
                {row.label}
              </span>
              <span className="block text-muted-foreground">{row.detail}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Prototype checks run in this browser. The real validator also runs
        before freezing, and only protected release decides access.
      </p>
    </section>
  );
}
