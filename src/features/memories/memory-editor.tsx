import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  FileText,
  Loader2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { kindMeta } from "@/components/chorus/memory-thumb";
import { PageHeader, TrustNote } from "@/components/chorus/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { actions, usePrototype } from "@/features/prototype/store";
import {
  LIMITS,
  collectionMemories,
  formatBytes,
  formatDuration,
  memoryStatus,
  personById,
} from "@/features/prototype/selectors";
import type {
  MediaInfo,
  MemoryKind,
  Person,
  PersonId,
  Processor,
  ProcessorId,
} from "@/features/prototype/types";
import { toPerson, useCollection } from "@/features/data/collections";
import { useViewer } from "@/features/data/current-user";
import { useConsentActions } from "@/features/data/consent";
import { useMemories, useMemoryActions } from "@/features/data/memories";
import { cn } from "@/lib/utils";
import { CountedField, PeoplePicker, codePoints } from "./fields";
import {
  acceptAny,
  anyFormatHelp,
  artworkFromSeed,
  detectAndCheckMediaFile,
  formatHelp,
  type MediaKind,
} from "./validate-media";

// One universal drop zone: the memory type is detected from each file's bytes
// rather than chosen up front. Each file becomes its own memory, because each
// memory carries its own people and consent decisions.

type Item = {
  id: string;
  file: File;
  url: string;
  phase: "checking" | "checked";
  kind?: MediaKind;
  errors: string[];
  media?: MediaInfo;
  format?: string;
  title: string;
  caption: string;
  story: string;
};

function titleFromName(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .slice(0, LIMITS.titleChars);
}

type PrepStep = { label: string; done: boolean };

/** What local preparation actually does on this backend. */
const prepModes: Record<
  EditorSource["prep"],
  { title: string; badge: string; steps: PrepStep[] }
> = {
  simulated: {
    title: "Prepared locally before encryption",
    badge: "Simulated",
    steps: [
      { label: "Type detected from file contents, not its name", done: true },
      { label: "Orientation normalized", done: true },
      { label: "EXIF, GPS, and location metadata removed", done: true },
      { label: "Encrypted on this device before upload", done: true },
    ],
  },
  dev: {
    title: "Prepared on this device",
    badge: "Development",
    steps: [
      { label: "Type detected from file contents, not its name", done: true },
      {
        label: "Photos re-encoded: orientation fixed, EXIF and GPS removed",
        done: true,
      },
      { label: "Audio and video metadata not removed yet", done: false },
      {
        label: "Not encrypted: stored unencrypted for development",
        done: false,
      },
    ],
  },
};

function PrepChecklist({
  ready,
  mode,
}: {
  ready: boolean;
  mode: EditorSource["prep"];
}) {
  const { title, badge, steps } = prepModes[mode];
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">{title}</p>
        <Badge variant="outline">{badge}</Badge>
      </div>
      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li
            key={s.label}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            {!s.done ? (
              <XCircle
                className="size-3.5 text-[var(--status-excluded)]"
                aria-hidden="true"
              />
            ) : ready ? (
              <CheckCircle2
                className="size-3.5 text-[var(--status-available)]"
                aria-hidden="true"
              />
            ) : (
              <Circle className="size-3.5" aria-hidden="true" />
            )}
            {s.label}
            <span className="sr-only">
              {!s.done
                ? "(not done)"
                : ready
                  ? "(done)"
                  : "(waiting for a file)"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Preview({ item }: { item: Item }) {
  if (item.phase === "checking" || !item.kind || item.errors.length)
    return (
      <div className="grid size-full place-items-center bg-muted text-muted-foreground">
        {item.phase === "checking" ? (
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <AlertCircle className="size-5" aria-hidden="true" />
        )}
      </div>
    );
  if (item.kind === "photo")
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
      <img
        src={item.url}
        alt={`Local preview of ${item.file.name}`}
        className="size-full object-cover"
      />
    );
  if (item.kind === "video")
    return (
      <video
        src={item.url}
        controls
        className="size-full bg-black object-contain"
        aria-label={`Local preview of ${item.file.name}`}
      />
    );
  return (
    <div className="flex size-full flex-col justify-center gap-2 bg-secondary p-3">
      <kindMeta.voice.icon className="size-5 text-primary" aria-hidden="true" />
      <audio
        src={item.url}
        controls
        className="w-full"
        aria-label={`Local preview of ${item.file.name}`}
      />
    </div>
  );
}

function ItemCard({
  item,
  showStory,
  onChange,
  onRemove,
}: {
  item: Item;
  showStory: boolean;
  onChange: (patch: Partial<Item>) => void;
  onRemove: () => void;
}) {
  const ok = item.phase === "checked" && item.errors.length === 0;
  const Icon = item.kind ? kindMeta[item.kind].icon : Upload;
  return (
    <li className="overflow-hidden rounded-xl border bg-card">
      <div className="grid gap-4 p-3 sm:grid-cols-[160px_minmax(0,1fr)]">
        <div className="aspect-[4/3] overflow-hidden rounded-lg border sm:aspect-square">
          <Preview item={item} />
        </div>
        <div className="min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0" aria-live="polite">
              <p className="truncate text-sm font-medium">{item.file.name}</p>
              {item.phase === "checking" ? (
                <p className="text-xs text-muted-foreground">
                  Checking on this device…
                </p>
              ) : ok && item.kind ? (
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="gap-1">
                    <Icon aria-hidden="true" />
                    {kindMeta[item.kind].label}
                  </Badge>
                  {item.format} · {formatBytes(item.file.size)}
                  {item.media?.durationSec !== undefined &&
                    ` · ${formatDuration(item.media.durationSec)}`}
                  {item.media?.width &&
                    ` · ${item.media.width}×${item.media.height}`}
                </p>
              ) : (
                <p className="text-xs font-medium text-destructive">
                  Can’t be used. Nothing was uploaded.
                </p>
              )}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Remove ${item.file.name}`}
              onClick={onRemove}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          {item.phase === "checked" && item.errors.length > 0 && (
            <ul className="list-disc space-y-1 pl-4 text-xs text-destructive">
              {item.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {item.errors.length === 0 && (
            <>
              <CountedField
                id={`${item.id}-title`}
                label="Title"
                value={item.title}
                onChange={(title) => onChange({ title })}
                limit={LIMITS.titleChars}
                required
              />
              <CountedField
                id={`${item.id}-caption`}
                label="Caption"
                value={item.caption}
                onChange={(caption) => onChange({ caption })}
                limit={LIMITS.captionChars}
                placeholder="A line to go with it in the photozine"
              />
              {showStory && (
                <CountedField
                  id={`${item.id}-story`}
                  label="Story"
                  value={item.story}
                  onChange={(story) => onChange({ story })}
                  limit={LIMITS.storyChars}
                  multiline
                  placeholder="Anything you want people to know"
                />
              )}
            </>
          )}
        </div>
      </div>
    </li>
  );
}

let itemCounter = 0;

/** One memory to save; the editor builds these from its form. */
export type EditorMemory = {
  itemId: string;
  kind: MemoryKind;
  title: string;
  caption: string;
  story: string;
  peopleIds: PersonId[];
  requestedProcessors: ProcessorId[];
  file?: File;
  media?: MediaInfo;
};

type SaveResult =
  | { ok: true; ids: string[] }
  | { ok: false; reason: string; savedItemIds: string[] };

/** Where the editor reads collection context from and saves to. */
type EditorSource = {
  members: Person[];
  viewerId: string;
  /** Processors to request AI permission for; null hides that section. */
  processors: Processor[] | null;
  existingCount: number;
  usedBytes: number;
  /** False until submission for approval exists on this backend (CH-06). */
  canSubmit: boolean;
  /** Simulated (prototype) or the real development preparation. */
  prep: "simulated" | "dev";
  trustNote: string;
  save: (memories: EditorMemory[], submit: boolean) => Promise<SaveResult>;
};

export function MemoryEditor({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  return state.collections.some((c) => c.id === collectionId) ? (
    <PrototypeMemoryEditor collectionId={collectionId} />
  ) : (
    <ConvexMemoryEditor collectionId={collectionId} />
  );
}

function PrototypeMemoryEditor({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  const collection = state.collections.find((c) => c.id === collectionId);
  if (!collection) return null;
  const existing = collectionMemories(state, collectionId).filter(
    (m) => m.submitted && memoryStatus(m) !== "excluded",
  );
  return (
    <MemoryEditorView
      collectionId={collectionId}
      source={{
        members: collection.memberIds.map((id) => personById(state, id)),
        viewerId: state.viewerId,
        processors: state.processors,
        existingCount: existing.length,
        usedBytes: existing.reduce((n, m) => n + (m.media?.sizeBytes ?? 0), 0),
        canSubmit: true,
        prep: "simulated",
        trustNote:
          "Prototype: files never leave this browser. Type detection uses the file’s contents; sanitization and encryption are simulated. The real build prepares and encrypts media on your device before anything is stored remotely.",
        save: async (memories, submit) => ({
          ok: true,
          ids: memories.map((m) =>
            actions.addMemory({
              collectionId,
              kind: m.kind,
              title: m.title,
              caption: m.caption,
              story: m.story,
              peopleIds: m.peopleIds,
              requestedProcessors: m.requestedProcessors,
              media: m.media,
              art:
                m.kind === "photo" || m.kind === "video"
                  ? artworkFromSeed(m.title + (m.file?.size ?? 0), m.title)
                  : undefined,
              submit,
            }),
          ),
        }),
      }}
    />
  );
}

function ConvexMemoryEditor({ collectionId }: { collectionId: string }) {
  const collection = useCollection(collectionId);
  const viewer = useViewer();
  const member = collection?.access === "member" ? collection : null;
  const memories = useMemories(member?.collectionId ?? null);
  const { addMemory } = useMemoryActions();
  const { submitMemory } = useConsentActions();
  if (!member || !viewer || !memories)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Opening the editor…
      </p>
    );
  const id = member.collectionId;
  return (
    <MemoryEditorView
      collectionId={collectionId}
      source={{
        members: member.members.map(toPerson),
        viewerId: viewer.userId,
        processors: null,
        existingCount: memories.length,
        usedBytes: memories.reduce(
          (n, m) => n + (m.head?.media?.byteLength ?? 0),
          0,
        ),
        canSubmit: true,
        prep: "dev",
        trustNote:
          "Encryption isn’t connected yet. Photos are re-encoded on your device to remove location and other hidden metadata; audio and video are kept as validated. For development, files and text are then stored unencrypted and labelled that way. Drafts are visible only to you; submitting asks everyone in the memory to review it. Consent is recorded locally and unverified until Tide is connected.",
        save: async (items, submit) => {
          const ids: string[] = [];
          const saved: string[] = [];
          for (const item of items) {
            const result = await addMemory(
              id,
              {
                kind: item.kind,
                title: item.title,
                caption: item.caption,
                story: item.story,
                peopleIds: item.peopleIds,
                file: item.file,
                media: item.media,
              },
              item.itemId,
            );
            if (!result.ok)
              return { ok: false, reason: result.reason, savedItemIds: saved };
            ids.push(result.result.memoryId);
            saved.push(item.itemId);
            // Saved as a draft either way; a failed submission can be retried
            // from the memory itself.
            if (submit) {
              const submitted = await submitMemory(
                result.result.memoryId,
                result.result.versionId,
              );
              if (!submitted.ok)
                return {
                  ok: false,
                  reason: `Saved as a private draft, but not submitted: ${submitted.reason}`,
                  savedItemIds: saved,
                };
            }
          }
          return { ok: true, ids };
        },
      }}
    />
  );
}

function MemoryEditorView({
  collectionId,
  source,
}: {
  collectionId: string;
  source: EditorSource;
}) {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"files" | "story">("files");
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [storyTitle, setStoryTitle] = useState("");
  const [storyText, setStoryText] = useState("");
  const [people, setPeople] = useState<PersonId[]>([]);
  const [declined, setDeclined] = useState<ProcessorId[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const urls = useRef(new Set<string>());
  const inputRef = useRef<HTMLInputElement>(null);

  // Revoke every temporary object URL when the editor closes.
  useEffect(() => {
    const live = urls.current;
    return () => {
      live.forEach((u) => URL.revokeObjectURL(u));
      live.clear();
    };
  }, []);

  function addFiles(list: FileList | File[] | null | undefined) {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setMode("files");
    for (const file of files) {
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      const id = `upload-${++itemCounter}`;
      setItems((prev) => [
        ...prev,
        {
          id,
          file,
          url,
          phase: "checking",
          errors: [],
          title: titleFromName(file.name),
          caption: "",
          story: "",
        },
      ]);
      void detectAndCheckMediaFile(file, url).then((result) =>
        setItems((prev) =>
          prev.map((it) =>
            it.id === id ? { ...it, phase: "checked", ...result } : it,
          ),
        ),
      );
    }
  }

  // Pasting a copied photo or file anywhere on the page adds it.
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const files = event.clipboardData?.files;
      if (files && files.length) {
        event.preventDefault();
        addFiles(files);
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  const members = source.members;
  const kindsPresent: MemoryKind[] =
    mode === "story"
      ? ["text"]
      : Array.from(
          new Set(items.filter((i) => i.kind).map((i) => i.kind as MemoryKind)),
        );
  const applicable = (source.processors ?? []).filter((p) =>
    p.appliesTo.some((k) => kindsPresent.includes(k)),
  );
  const slotsLeft = Math.max(LIMITS.activeMemories - source.existingCount, 0);
  const usedBytes = source.usedBytes;
  const usable = items.filter(
    (i) => i.phase === "checked" && i.errors.length === 0 && i.kind,
  );
  const pending = items.some((i) => i.phase === "checking");
  const newBytes = usable.reduce((n, i) => n + i.file.size, 0);

  function removeItem(id: string) {
    setItems((prev) => {
      const gone = prev.find((i) => i.id === id);
      if (gone) {
        URL.revokeObjectURL(gone.url);
        urls.current.delete(gone.url);
      }
      return prev.filter((i) => i.id !== id);
    });
  }

  function patchItem(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  const errors: string[] = [];
  if (mode === "story") {
    if (!storyTitle.trim()) errors.push("Add a title.");
    if (codePoints(storyTitle) > LIMITS.titleChars)
      errors.push(`Shorten the title to ${LIMITS.titleChars} characters.`);
    if (!storyText.trim()) errors.push("Write the story for this memory.");
    if (codePoints(storyText) > LIMITS.storyChars)
      errors.push(`Shorten the story to ${LIMITS.storyChars} characters.`);
    if (slotsLeft < 1)
      errors.push("This collection already has twelve active memories.");
  } else {
    if (items.length === 0) errors.push("Add at least one file.");
    if (pending) errors.push("Wait for every file to finish checking.");
    if (items.some((i) => i.phase === "checked" && i.errors.length))
      errors.push("Remove the files that can’t be used.");
    for (const i of usable) {
      if (!i.title.trim()) errors.push(`Add a title for ${i.file.name}.`);
      if (codePoints(i.title) > LIMITS.titleChars)
        errors.push(`Shorten the title of ${i.file.name}.`);
      if (codePoints(i.caption) > LIMITS.captionChars)
        errors.push(`Shorten the caption of ${i.file.name}.`);
      if (codePoints(i.story) > LIMITS.storyChars)
        errors.push(`Shorten the story of ${i.file.name}.`);
    }
    if (usable.length > slotsLeft)
      errors.push(
        `Only ${slotsLeft} more ${slotsLeft === 1 ? "memory fits" : "memories fit"} in this collection (twelve active at most). Remove ${usable.length - slotsLeft} to continue.`,
      );
    if (usedBytes + newBytes > LIMITS.collectionBytes)
      errors.push(
        `These files would take the collection past its ${formatBytes(LIMITS.collectionBytes)} budget.`,
      );
  }

  function requestedFor(kind: MemoryKind) {
    return (source.processors ?? [])
      .filter((p) => p.appliesTo.includes(kind) && !declined.includes(p.id))
      .map((p) => p.id);
  }

  async function save(submit: boolean) {
    setTriedSubmit(true);
    if (errors.length || submitting) return;
    setSubmitting(true);
    setSaveError(null);
    const memories: EditorMemory[] =
      mode === "story"
        ? [
            {
              itemId: "story",
              kind: "text",
              title: storyTitle.trim(),
              caption: "",
              story: storyText.trim(),
              peopleIds: people,
              requestedProcessors: requestedFor("text"),
            },
          ]
        : usable.map((i) => ({
            itemId: i.id,
            kind: i.kind!,
            title: i.title.trim(),
            caption: i.caption.trim(),
            story: i.story.trim(),
            peopleIds: people,
            requestedProcessors: requestedFor(i.kind!),
            file: i.file,
            media: i.media,
          }));
    const result = await source.save(memories, submit);
    setSubmitting(false);
    if (!result.ok) {
      // Keep only what wasn't saved, so trying again can't duplicate.
      for (const id of result.savedItemIds) removeItem(id);
      setSaveError(result.reason);
      return;
    }
    if (result.ids.length === 1)
      void navigate({
        to: "/collections/$collectionId/memories/$memoryId",
        params: { collectionId, memoryId: result.ids[0] },
      });
    else
      void navigate({
        to: "/collections/$collectionId",
        params: { collectionId },
      });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void save(source.canSubmit);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    addFiles(event.dataTransfer.files);
  }

  const count = mode === "story" ? 1 : usable.length;
  const noun = count === 1 ? "memory" : "memories";

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <PageHeader
        eyebrow="New memory"
        title="Add memories"
        description="Drop in anything: photos, voice notes, or short videos. Chorus recognizes each file. Every file becomes its own memory, and everyone you declare decides on it separately."
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          {mode === "files" ? (
            <>
              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node))
                    setDragging(false);
                }}
                onDrop={onDrop}
                className={cn(
                  "rounded-2xl border-2 border-dashed bg-card px-4 text-center transition-colors",
                  items.length ? "py-6" : "py-12",
                  dragging
                    ? "border-primary bg-secondary/60"
                    : "border-border hover:border-primary/40",
                )}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="flex -space-x-2" aria-hidden="true">
                    {(["photo", "voice", "video"] as const).map((k) => {
                      const Icon = kindMeta[k].icon;
                      return (
                        <span
                          key={k}
                          className="grid size-10 place-items-center rounded-full border bg-background text-primary"
                        >
                          <Icon className="size-4" />
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-base font-medium">
                    {dragging
                      ? "Drop to add"
                      : items.length
                        ? "Add more files"
                        : "Drop photos, voice notes, or videos here"}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => inputRef.current?.click()}
                    >
                      <Upload aria-hidden="true" />
                      Choose files
                    </Button>
                    <span>or paste from your clipboard</span>
                  </div>
                  <input
                    ref={inputRef}
                    id="memory-files"
                    type="file"
                    multiple
                    accept={acceptAny}
                    className="sr-only"
                    aria-label="Choose photos, voice notes, or videos"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">
                      {anyFormatHelp}
                    </summary>
                    <ul className="mt-2 space-y-1 text-left">
                      {(["photo", "voice", "video"] as const).map((k) => (
                        <li key={k}>
                          <span className="font-medium text-foreground">
                            {kindMeta[k].label}:
                          </span>{" "}
                          {formatHelp[k]}
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMode("story")}
                className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left text-sm transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <FileText className="size-5 text-primary" aria-hidden="true" />
                <span>
                  <span className="block font-medium">
                    No file? Write a story instead
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    A memory in your own words, with no photo or recording.
                  </span>
                </span>
              </button>
              {items.length > 0 && (
                <section aria-labelledby="upload-list" className="space-y-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 id="upload-list" className="text-sm font-semibold">
                      {items.length} {items.length === 1 ? "file" : "files"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {slotsLeft} of {LIMITS.activeMemories} memory slots left
                    </p>
                  </div>
                  <ul className="space-y-3">
                    {items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        showStory={items.length === 1}
                        onChange={(patch) => patchItem(item.id, patch)}
                        onRemove={() => removeItem(item.id)}
                      />
                    ))}
                  </ul>
                  {items.length > 1 && (
                    <p className="text-xs text-muted-foreground">
                      Add a longer story to any memory later, from its own page.
                    </p>
                  )}
                </section>
              )}
            </>
          ) : (
            <section
              aria-labelledby="story-heading"
              className="space-y-4 rounded-2xl border bg-card p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h2
                  id="story-heading"
                  className="flex items-center gap-2 text-sm font-semibold"
                >
                  <FileText
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                  Write a story
                </h2>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setMode("files")}
                >
                  <Upload aria-hidden="true" />
                  Add files instead
                </Button>
              </div>
              <CountedField
                id="story-title"
                label="Title"
                value={storyTitle}
                onChange={setStoryTitle}
                limit={LIMITS.titleChars}
                required
              />
              <CountedField
                id="story-text"
                label="Story"
                value={storyText}
                onChange={setStoryText}
                limit={LIMITS.storyChars}
                multiline
                required
                placeholder="Write the memory in your own words"
              />
            </section>
          )}
        </div>

        <div className="min-w-0 space-y-6">
          <PeoplePicker
            people={members}
            uploaderId={source.viewerId}
            selected={people}
            onChange={setPeople}
          />
          {mode === "files" && items.length > 1 && (
            <p className="-mt-3 text-xs text-muted-foreground">
              Applies to every file here. You can change who is in each memory
              afterwards, which creates a new version.
            </p>
          )}

          {source.processors && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Ask permission for AI processing
              </legend>
              <p className="text-xs text-muted-foreground">
                Each person decides on these separately from manual use. Nothing
                is sent until everyone approves.
              </p>
              {applicable.length === 0 ? (
                <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                  Add a file to see which processors apply.
                </p>
              ) : (
                <ul className="space-y-2">
                  {applicable.map((p) => {
                    const id = `proc-${p.id}`;
                    const on = !declined.includes(p.id);
                    const kinds = p.appliesTo
                      .filter((k) => kindsPresent.includes(k))
                      .map((k) => kindMeta[k].label.toLowerCase());
                    return (
                      <li key={p.id}>
                        <label
                          htmlFor={id}
                          className={cn(
                            "flex cursor-pointer gap-3 rounded-lg border bg-card p-3 text-sm has-focus-visible:ring-2 has-focus-visible:ring-ring/50",
                            on && "border-primary/40",
                          )}
                        >
                          <Checkbox
                            id={id}
                            checked={on}
                            className="mt-0.5"
                            onCheckedChange={(v) =>
                              setDeclined((prev) =>
                                v
                                  ? prev.filter((x) => x !== p.id)
                                  : [...prev, p.id],
                              )
                            }
                          />
                          <span className="min-w-0 space-y-1">
                            <span className="block font-medium">{p.name}</span>
                            <span className="block text-xs text-muted-foreground">
                              {p.role}
                              {mode === "files" && ` · for ${kinds.join(", ")}`}
                            </span>
                            <span className="block text-xs">
                              <span className="text-muted-foreground">
                                Receives:{" "}
                              </span>
                              {p.receives.join("; ")}
                            </span>
                            <span className="block text-xs">
                              <span className="text-muted-foreground">
                                Retention:{" "}
                              </span>
                              {p.retention}
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>
          )}

          {mode === "files" && (
            <PrepChecklist
              ready={usable.length > 0 && usable.length === items.length}
              mode={source.prep}
            />
          )}

          <TrustNote>{source.trustNote}</TrustNote>
        </div>
      </div>

      {saveError && (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Not saved</AlertTitle>
          <AlertDescription>{saveError}</AlertDescription>
        </Alert>
      )}

      {triedSubmit && errors.length > 0 && (
        <Alert variant="destructive" role="alert">
          <AlertCircle aria-hidden="true" />
          <AlertTitle>Not saved yet</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-5">
        <Button variant="ghost" asChild>
          <Link to="/collections/$collectionId" params={{ collectionId }}>
            Cancel
          </Link>
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={submitting}
          onClick={() => void save(false)}
        >
          {count > 1 ? `Save ${count} private drafts` : "Save private draft"}
        </Button>
        {source.canSubmit && (
          <Button type="submit" disabled={submitting}>
            {count > 1
              ? `Submit ${count} ${noun} for approval`
              : "Submit for approval"}
          </Button>
        )}
      </div>
    </form>
  );
}
