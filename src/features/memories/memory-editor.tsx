import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Loader2,
  Upload,
} from "lucide-react";
import { kindMeta } from "@/components/chorus/memory-thumb";
import { PageHeader, TrustNote } from "@/components/chorus/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  PersonId,
  ProcessorId,
} from "@/features/prototype/types";
import { cn } from "@/lib/utils";
import { CountedField, PeoplePicker, codePoints } from "./fields";
import {
  acceptFor,
  artworkFromSeed,
  checkMediaFile,
  formatHelp,
} from "./validate-media";

type FileState =
  | { phase: "empty" }
  | { phase: "checking"; file: File; url: string }
  | {
      phase: "checked";
      file: File;
      url: string;
      errors: string[];
      media?: MediaInfo;
      format?: string;
    };

const kinds: MemoryKind[] = ["photo", "voice", "video", "text"];

function PrepChecklist({ ready }: { ready: boolean }) {
  const steps = [
    "Format checked from file contents, not its name",
    "Orientation normalized",
    "EXIF, GPS, and location metadata removed",
    "Encrypted on this device before upload",
  ];
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold">
          Prepared locally before encryption
        </p>
        <Badge variant="outline">Simulated</Badge>
      </div>
      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li
            key={s}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            {ready ? (
              <CheckCircle2
                className="size-3.5 text-[var(--status-available)]"
                aria-hidden="true"
              />
            ) : (
              <Circle className="size-3.5" aria-hidden="true" />
            )}
            {s}
            <span className="sr-only">
              {ready ? "(done)" : "(waiting for a file)"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MemoryEditor({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  const navigate = useNavigate();
  const collection = state.collections.find((c) => c.id === collectionId);
  const [kind, setKind] = useState<MemoryKind>("photo");
  const [fileState, setFileState] = useState<FileState>({ phase: "empty" });
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [story, setStory] = useState("");
  const [people, setPeople] = useState<PersonId[]>([]);
  const [processors, setProcessors] = useState<ProcessorId[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);
  const urlRef = useRef<string | null>(null);

  // Revoke temporary object URLs when the file changes or the editor closes.
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  if (!collection) return null;
  const members = collection.memberIds.map((id) => personById(state, id));
  const applicable = state.processors.filter((p) => p.appliesTo.includes(kind));
  const requested = processors ?? applicable.map((p) => p.id);
  const active = collectionMemories(state, collectionId).filter(
    (m) => m.submitted && memoryStatus(m) !== "excluded",
  ).length;

  function resetFile() {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setFileState({ phase: "empty" });
  }

  async function onFile(file: File | undefined) {
    resetFile();
    if (!file || kind === "text") return;
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setFileState({ phase: "checking", file, url });
    if (!title)
      setTitle(
        file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[-_]+/g, " ")
          .slice(0, 80),
      );
    const result = await checkMediaFile(file, kind, url);
    if (urlRef.current !== url) return; // A newer file replaced this one.
    setFileState({ phase: "checked", file, url, ...result });
  }

  const errors: string[] = [];
  if (!title.trim()) errors.push("Add a title.");
  if (codePoints(title) > LIMITS.titleChars)
    errors.push(`Shorten the title to ${LIMITS.titleChars} characters.`);
  if (codePoints(caption) > LIMITS.captionChars)
    errors.push(`Shorten the caption to ${LIMITS.captionChars} characters.`);
  if (codePoints(story) > LIMITS.storyChars)
    errors.push(`Shorten the story to ${LIMITS.storyChars} characters.`);
  if (kind === "text" && !story.trim())
    errors.push("Write the story for this memory.");
  if (kind !== "text" && fileState.phase !== "checked")
    errors.push("Choose a file.");
  if (fileState.phase === "checked" && fileState.errors.length)
    errors.push("Fix the file problems above.");
  if (active >= LIMITS.activeMemories)
    errors.push("This collection already has twelve active memories.");

  function save(submit: boolean) {
    setTriedSubmit(true);
    if (errors.length || submitting) return;
    setSubmitting(true);
    const media = fileState.phase === "checked" ? fileState.media : undefined;
    const memoryId = actions.addMemory({
      collectionId,
      kind,
      title: title.trim(),
      caption: caption.trim(),
      story: story.trim(),
      peopleIds: people,
      requestedProcessors: requested,
      media,
      art:
        kind === "photo" || kind === "video"
          ? artworkFromSeed(title + (media?.sizeBytes ?? 0), title.trim())
          : undefined,
      submit,
    });
    resetFile();
    void navigate({
      to: "/collections/$collectionId/memories/$memoryId",
      params: { collectionId, memoryId },
    });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    save(true);
  }

  const checked = fileState.phase === "checked" ? fileState : null;
  const fileOk = checked && checked.errors.length === 0;

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <PageHeader
        eyebrow="New memory"
        title="Add a memory"
        description="Everyone you declare will review this exact version and decide, separately, on manual use and on AI processing."
      />

      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">What are you adding?</legend>
        <div
          role="radiogroup"
          aria-label="Memory type"
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
        >
          {kinds.map((k) => {
            const Icon = kindMeta[k].icon;
            const selected = kind === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => {
                  setKind(k);
                  setProcessors(null);
                  resetFile();
                }}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border bg-card p-3 text-left text-sm transition-colors hover:border-primary/40 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  selected && "border-primary bg-secondary/60",
                )}
              >
                <Icon className="size-5 text-primary" aria-hidden="true" />
                <span className="font-medium">{kindMeta[k].label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {kind !== "text" && (
            <div className="space-y-3">
              <Label htmlFor="memory-file">File</Label>
              <label
                htmlFor="memory-file"
                className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-8 text-center text-sm hover:border-primary/50 has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
              >
                <Upload className="size-5 text-primary" aria-hidden="true" />
                <span className="font-medium">
                  {fileState.phase === "empty"
                    ? "Choose a file"
                    : "Choose a different file"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatHelp[kind]}
                </span>
                <input
                  id="memory-file"
                  type="file"
                  accept={acceptFor[kind]}
                  className="sr-only"
                  aria-describedby="memory-file-status"
                  onChange={(e) => void onFile(e.target.files?.[0])}
                />
              </label>
              <div id="memory-file-status" aria-live="polite">
                {fileState.phase === "checking" && (
                  <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />{" "}
                    Checking {fileState.file.name} on this device…
                  </p>
                )}
                {checked && checked.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle aria-hidden="true" />
                    <AlertTitle>{checked.file.name} can’t be used</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc space-y-1 pl-4">
                        {checked.errors.map((e) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                      <p className="mt-2">Nothing was uploaded.</p>
                    </AlertDescription>
                  </Alert>
                )}
                {fileOk && (
                  <p className="inline-flex items-center gap-2 text-sm">
                    <CheckCircle2
                      className="size-4 text-[var(--status-available)]"
                      aria-hidden="true"
                    />
                    {checked.format} · {formatBytes(checked.file.size)}
                    {checked.media?.durationSec !== undefined &&
                      ` · ${formatDuration(checked.media.durationSec)}`}
                    {checked.media?.width &&
                      ` · ${checked.media.width}×${checked.media.height}`}
                  </p>
                )}
              </div>
              {fileState.phase !== "empty" && (
                <div className="overflow-hidden rounded-xl border bg-muted">
                  {kind === "photo" && (
                    // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                    <img
                      src={fileState.url}
                      alt="Local preview of the selected photo"
                      className="max-h-80 w-full object-contain"
                    />
                  )}
                  {kind === "voice" && (
                    <audio src={fileState.url} controls className="w-full p-3">
                      Your browser can’t play this preview.
                    </audio>
                  )}
                  {kind === "video" && (
                    <video
                      src={fileState.url}
                      controls
                      className="max-h-80 w-full bg-black"
                    >
                      Your browser can’t play this preview.
                    </video>
                  )}
                  <p className="border-t bg-card px-3 py-2 text-xs text-muted-foreground">
                    This preview stays on your device. The object URL is revoked
                    when you leave.
                  </p>
                </div>
              )}
              <PrepChecklist ready={!!fileOk} />
            </div>
          )}

          <CountedField
            id="memory-title"
            label="Title"
            value={title}
            onChange={setTitle}
            limit={LIMITS.titleChars}
            required
          />
          {kind !== "text" && (
            <CountedField
              id="memory-caption"
              label="Caption"
              value={caption}
              onChange={setCaption}
              limit={LIMITS.captionChars}
              placeholder="A line to go with it in the photozine"
            />
          )}
          <CountedField
            id="memory-story"
            label="Story"
            value={story}
            onChange={setStory}
            limit={LIMITS.storyChars}
            multiline
            required={kind === "text"}
            placeholder={
              kind === "text"
                ? "Write the memory in your own words"
                : "Anything you want people to know"
            }
          />
        </div>

        <div className="space-y-6">
          <PeoplePicker
            people={members}
            uploaderId={state.viewerId}
            selected={people}
            onChange={setPeople}
          />

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">
              Ask permission for AI processing
            </legend>
            <p className="text-xs text-muted-foreground">
              Each person decides on these separately from manual use. Anyone
              can approve manual use and decline AI. Nothing is sent until
              everyone approves.
            </p>
            <ul className="space-y-2">
              {applicable.map((p) => {
                const id = `proc-${p.id}`;
                const on = requested.includes(p.id);
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
                          setProcessors(
                            v
                              ? [...requested, p.id]
                              : requested.filter((x) => x !== p.id),
                          )
                        }
                      />
                      <span className="min-w-0 space-y-1">
                        <span className="block font-medium">{p.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {p.role}
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
          </fieldset>

          <TrustNote>
            Prototype: files never leave this browser. Sanitization and
            encryption are simulated. The real build prepares and encrypts media
            on your device before anything is stored remotely.
          </TrustNote>
        </div>
      </div>

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
          onClick={() => save(false)}
        >
          Save private draft
        </Button>
        <Button type="submit" disabled={submitting}>
          Submit for approval
        </Button>
      </div>
    </form>
  );
}
