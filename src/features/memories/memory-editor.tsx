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
  ArrowLeft,
  FileText,
  CheckCircle2,
  Loader2,
  Plus,
  X,
  XCircle,
} from "lucide-react";
import { kindMeta } from "@/components/chorus/memory-thumb";
import { TrustNote } from "@/components/chorus/page-header";
import { ActionBar, Disclosure } from "@/components/chorus/primitives";
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

// One universal picker: the memory type is detected from each file's bytes
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
  { title: string; steps: PrepStep[] }
> = {
  simulated: {
    title: "Prepared locally before encryption (simulated)",
    steps: [
      { label: "Type detected from file contents, not its name", done: true },
      { label: "Orientation normalized", done: true },
      { label: "EXIF, GPS, and location metadata removed", done: true },
      { label: "Encrypted on this device before upload", done: true },
    ],
  },
  dev: {
    title: "Prepared on this device (development)",
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

function PrepNote({
  mode,
  note,
}: {
  mode: EditorSource["prep"];
  note: string;
}) {
  const { title, steps } = prepModes[mode];
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <ul className="space-y-1">
        {steps.map((s) => (
          <li key={s.label} className="flex items-start gap-2">
            {s.done ? (
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0 text-[var(--status-available)]"
                aria-hidden="true"
              />
            ) : (
              <XCircle
                className="mt-0.5 size-4 shrink-0 text-[var(--status-excluded)]"
                aria-hidden="true"
              />
            )}
            <span>
              {s.label}
              <span className="sr-only">
                {s.done ? " (done)" : " (not done)"}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p>{note}</p>
    </div>
  );
}

function Preview({ item, big }: { item: Item; big: boolean }) {
  if (item.phase === "checking" || !item.kind || item.errors.length)
    return (
      <div className="grid size-full place-items-center bg-muted text-muted-foreground">
        {item.phase === "checking" ? (
          <Loader2 className="size-6 animate-spin" aria-hidden="true" />
        ) : (
          <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
        )}
      </div>
    );
  if (item.kind === "photo")
    return (
      // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
      <img
        src={item.url}
        alt={`Preview of ${item.file.name}`}
        className="size-full object-cover"
      />
    );
  if (item.kind === "video")
    return (
      <video
        src={item.url}
        controls={big}
        className="size-full bg-black object-contain"
        aria-label={`Preview of ${item.file.name}`}
      />
    );
  const Icon = kindMeta.voice.icon;
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 bg-accent p-4">
      <Icon className="size-8 text-primary" aria-hidden="true" />
      <audio
        src={item.url}
        controls
        className="w-full"
        aria-label={`Preview of ${item.file.name}`}
      />
    </div>
  );
}

function ItemCard({
  item,
  single,
  onChange,
  onRemove,
}: {
  item: Item;
  single: boolean;
  onChange: (patch: Partial<Item>) => void;
  onRemove: () => void;
}) {
  const ok = item.phase === "checked" && item.errors.length === 0;
  return (
    <li className="space-y-3">
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl bg-card shadow-soft ring-1 ring-border",
          single ? "aspect-[4/3]" : "aspect-[16/9]",
        )}
      >
        <Preview item={item} big={single} />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="absolute top-2 right-2 rounded-full shadow-soft"
          aria-label={`Remove ${item.file.name}`}
          onClick={onRemove}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <div aria-live="polite">
        {item.phase === "checking" ? (
          <p className="text-sm text-muted-foreground">Checking your file</p>
        ) : ok && item.kind ? (
          <p className="tabular text-sm text-muted-foreground">
            {kindMeta[item.kind].label} · {formatBytes(item.file.size)}
            {item.media?.durationSec !== undefined &&
              ` · ${formatDuration(item.media.durationSec)}`}
          </p>
        ) : (
          <div role="alert" className="space-y-1 text-sm text-destructive">
            <p className="font-medium">This file can’t be used. Try another.</p>
            <ul className="list-disc pl-5">
              {item.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {ok && (
        <div className="space-y-4">
          <CountedField
            id={`${item.id}-caption`}
            label="Caption"
            value={item.caption}
            onChange={(caption) => onChange({ caption })}
            limit={LIMITS.captionChars}
            placeholder="A line to go with it"
          />
          <CountedField
            id={`${item.id}-title`}
            label="Title"
            value={item.title}
            onChange={(title) => onChange({ title })}
            limit={LIMITS.titleChars}
            required
          />
        </div>
      )}
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
        Opening the editor
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
    if (!storyText.trim()) errors.push("Write your story.");
    if (codePoints(storyText) > LIMITS.storyChars)
      errors.push(`Shorten the story to ${LIMITS.storyChars} characters.`);
    if (slotsLeft < 1) errors.push("This zine already has twelve memories.");
  } else {
    if (items.length === 0) errors.push("Choose a photo, voice note or video.");
    if (pending) errors.push("Hold on, still checking your file.");
    if (items.some((i) => i.phase === "checked" && i.errors.length))
      errors.push("Remove the file that can’t be used.");
    for (const i of usable) {
      if (!i.title.trim()) errors.push("Add a title.");
      if (codePoints(i.title) > LIMITS.titleChars)
        errors.push(`Shorten the title of ${i.file.name}.`);
      if (codePoints(i.caption) > LIMITS.captionChars)
        errors.push(`Shorten the caption of ${i.file.name}.`);
      if (codePoints(i.story) > LIMITS.storyChars)
        errors.push(`Shorten the story of ${i.file.name}.`);
    }
    if (usable.length > slotsLeft)
      errors.push(
        `Only ${slotsLeft} more ${slotsLeft === 1 ? "memory fits" : "memories fit"} in this zine. Remove ${usable.length - slotsLeft} to continue.`,
      );
    if (usedBytes + newBytes > LIMITS.collectionBytes)
      errors.push(
        `This would go over the ${formatBytes(LIMITS.collectionBytes)} limit for the zine.`,
      );
  }
  const uniqueErrors = Array.from(new Set(errors));

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
  const single = items.length === 1;

  const fileInput = (
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
  );

  return (
    <form
      onSubmit={onSubmit}
      className="mx-auto w-full max-w-xl space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300"
      noValidate
    >
      <div className="space-y-2">
        <Link
          to="/collections/$collectionId"
          params={{ collectionId }}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Back
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Add memory
        </h1>
      </div>

      {mode === "files" ? (
        <div className="space-y-5">
          {items.length > 0 && (
            <ul className="space-y-6">
              {items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  single={single}
                  onChange={(patch) => patchItem(item.id, patch)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </ul>
          )}
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
          >
            {items.length === 0 ? (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={cn(
                  "press flex min-h-72 w-full flex-col items-center justify-center gap-4 rounded-[2rem] bg-card px-4 py-10 text-center shadow-soft ring-1 ring-border transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  dragging && "bg-accent ring-2 ring-primary",
                )}
              >
                <span className="flex -space-x-2" aria-hidden="true">
                  {(["photo", "voice", "video"] as const).map((k) => {
                    const Icon = kindMeta[k].icon;
                    return (
                      <span
                        key={k}
                        className="grid size-12 place-items-center rounded-full bg-lime text-lime-ink ring-4 ring-card"
                      >
                        <Icon className="size-5" />
                      </span>
                    );
                  })}
                </span>
                <span className="text-2xl font-semibold tracking-tight">
                  {dragging
                    ? "Drop to add"
                    : "Add a photo, voice note or video"}
                </span>
                <span className="text-sm text-muted-foreground">
                  Tap to choose
                </span>
              </button>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => inputRef.current?.click()}
              >
                <Plus aria-hidden="true" /> Add another
              </Button>
            )}
            {fileInput}
          </div>
          {items.length === 0 && (
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setMode("story")}
            >
              <FileText aria-hidden="true" /> Or write a story
            </Button>
          )}
        </div>
      ) : (
        <section aria-label="Write a story" className="space-y-4">
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
            placeholder="Write it in your own words"
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => setMode("files")}
          >
            Add a file instead
          </Button>
        </section>
      )}

      <PeoplePicker
        people={members}
        uploaderId={source.viewerId}
        selected={people}
        onChange={setPeople}
      />

      {source.prep === "dev" && (
        <TrustNote>
          Dev mode: files are stored unencrypted, and consent is recorded
          locally until Tide is connected.
        </TrustNote>
      )}
      <Disclosure summary="More options">
        {mode === "files" && single && usable.length === 1 && (
          <CountedField
            id="more-story"
            label="Longer story"
            value={items[0].story}
            onChange={(story) => patchItem(items[0].id, { story })}
            limit={LIMITS.storyChars}
            multiline
            placeholder="Anything you want people to know"
          />
        )}
        {source.processors && applicable.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground">
              Let AI help (optional)
            </legend>
            <p>Nothing is sent until everyone approves.</p>
            <ul className="space-y-2">
              {applicable.map((p) => {
                const id = `proc-${p.id}`;
                const on = !declined.includes(p.id);
                return (
                  <li key={p.id}>
                    <label
                      htmlFor={id}
                      className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl bg-card p-3 ring-1 ring-border has-focus-visible:ring-2 has-focus-visible:ring-ring"
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
                      <span className="min-w-0">
                        <span className="block font-medium text-foreground">
                          {p.name}
                        </span>
                        <span className="block text-sm">{p.role}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}
        <p className="tabular">
          {slotsLeft} of {LIMITS.activeMemories} spots left in this zine.
        </p>
        <PrepNote mode={source.prep} note={source.trustNote} />
        {mode === "files" && (
          <details>
            <summary className="min-h-11 cursor-pointer py-2">
              {anyFormatHelp}
            </summary>
            <ul className="space-y-1">
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
        )}
      </Disclosure>

      {saveError && (
        <div
          role="alert"
          className="flex gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">Not saved</p>
            <p>{saveError}</p>
          </div>
        </div>
      )}

      {triedSubmit && uniqueErrors.length > 0 && (
        <div
          role="alert"
          className="flex gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <ul className="space-y-0.5">
            {uniqueErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <ActionBar>
        {source.canSubmit && (
          <Button
            type="submit"
            size="lg"
            variant="highlight"
            disabled={submitting}
          >
            {count > 1 ? `Submit ${count} for approval` : "Submit for approval"}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          disabled={submitting}
          className="sm:order-first"
          onClick={() => void save(false)}
        >
          {count > 1 ? `Save ${count} drafts` : "Save as draft"}
        </Button>
      </ActionBar>
    </form>
  );
}
