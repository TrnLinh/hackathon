import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  MoreHorizontal,
  X,
  CheckCircle2,
  Circle,
  Clock3,
  Film,
  Keyboard,
  Laptop,
  Lock,
  Mic,
  PenLine,
  Plus,
  PowerOff,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { ArtworkFill } from "@/components/chorus/memory-thumb";
import { MediaPreview } from "@/components/chorus/media-preview";
import { EmptyState, TrustNote } from "@/components/chorus/page-header";
import { ActionBar, Disclosure } from "@/components/chorus/primitives";
import { PersonAvatar } from "@/components/chorus/people";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DecisionBadge,
  MemoryStatusBadge,
  memoryStatusHint,
} from "@/components/chorus/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { actions, usePrototype } from "@/features/prototype/store";
import {
  LIMITS,
  approverIds,
  formatBytes,
  formatDuration,
  formatWhen,
  manualEligible,
  memoryStatus,
  pendingApproverIds,
  personById,
} from "@/features/prototype/selectors";
import type {
  Memory,
  PrototypeState,
  TranscriptExcerpt,
} from "@/features/prototype/types";
import { BudgetMeter } from "@/features/collections/budget-meter";
import { cn } from "@/lib/utils";
import { CountedField, PeoplePicker, codePoints } from "./fields";
import { ConvexMemoryDetail } from "./convex-memories";

const processorShort: Record<string, string> = {
  transcriber: "Transcription",
  vision: "Visual analysis",
  designer: "Design",
};

function ReviseDialog({
  memory,
  state,
}: {
  memory: Memory;
  state: PrototypeState;
}) {
  const collection = state.collections.find(
    (c) => c.id === memory.collectionId,
  );
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState(memory.caption);
  const [story, setStory] = useState(memory.story);
  const [people, setPeople] = useState(memory.peopleIds);
  const [note, setNote] = useState("");
  const tooLong =
    codePoints(caption) > LIMITS.captionChars ||
    codePoints(story) > LIMITS.storyChars;
  const unchanged =
    caption === memory.caption &&
    story === memory.story &&
    people.slice().sort().join() === memory.peopleIds.slice().sort().join();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setCaption(memory.caption);
          setStory(memory.story);
          setPeople(memory.peopleIds);
          setNote("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" variant="highlight">
          <PenLine aria-hidden="true" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Publish a new version</DialogTitle>
          <DialogDescription>
            Version {memory.version + 1} replaces version {memory.version} for
            future use. Earlier versions stay unchanged in history.
          </DialogDescription>
        </DialogHeader>
        <div
          role="note"
          className="rounded-2xl bg-accent p-3 text-sm leading-relaxed"
        >
          <strong>Approvals reset.</strong> Everyone in the memory must review
          the new version again. Designs and candidates that used it become
          invalid and must be rebuilt.
        </div>
        <div className="space-y-4">
          {memory.kind !== "text" && (
            <CountedField
              id="revise-caption"
              label="Caption"
              value={caption}
              onChange={setCaption}
              limit={LIMITS.captionChars}
            />
          )}
          <CountedField
            id="revise-story"
            label="Story"
            value={story}
            onChange={setStory}
            limit={LIMITS.storyChars}
            multiline
            required={memory.kind === "text"}
          />
          {collection && (
            <PeoplePicker
              people={collection.memberIds.map((id) => personById(state, id))}
              uploaderId={memory.uploaderId}
              selected={people}
              onChange={setPeople}
            />
          )}
          <div className="space-y-1.5">
            <Label htmlFor="revise-note">What changed?</Label>
            <Input
              id="revise-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Fixed the caption after Leo’s edit request"
            />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            disabled={tooLong || unchanged}
            onClick={() => {
              actions.reviseMemory(
                memory.id,
                { caption, story, peopleIds: people },
                note.trim() || "Revised by the uploader",
              );
              setOpen(false);
            }}
          >
            Publish version {memory.version + 1}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function parseTime(value: string): number | null {
  const m = /^\s*(\d{1,2}):([0-5]\d)\s*$/.exec(value);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function SourceBadge({ source }: { source: TranscriptExcerpt["source"] }) {
  return source === "ai" ? (
    <Badge variant="outline" className="gap-1">
      <Sparkles aria-hidden="true" /> Transcribed by AI
    </Badge>
  ) : (
    <Badge variant="secondary" className="gap-1">
      <Keyboard aria-hidden="true" /> Typed by hand
    </Badge>
  );
}

function ExcerptRow({
  memory,
  excerpt,
  state,
  editable,
}: {
  memory: Memory;
  excerpt: TranscriptExcerpt;
  state: PrototypeState;
  editable: boolean;
}) {
  const [text, setText] = useState(excerpt.text);
  const id = `excerpt-${excerpt.id}`;
  return (
    <li className="space-y-2 rounded-2xl bg-card p-3 ring-1 ring-border">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <span className="font-mono">
          {formatDuration(excerpt.startSec)} to {formatDuration(excerpt.endSec)}
        </span>
        <SourceBadge source={excerpt.source} />
        <span className="ml-auto">
          {excerpt.reviewed ? (
            <span className="inline-flex items-center gap-1 text-[var(--status-available)]">
              <CheckCircle2 className="size-3.5" aria-hidden="true" /> Reviewed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[var(--status-awaiting)]">
              <Circle className="size-3.5" aria-hidden="true" /> Needs review
            </span>
          )}
        </span>
      </div>
      <Label htmlFor={id} className="sr-only">
        Excerpt at {formatDuration(excerpt.startSec)}
      </Label>
      <Textarea
        id={id}
        value={text}
        readOnly={!editable}
        rows={2}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text !== excerpt.text)
            actions.updateExcerpt(memory.id, excerpt.id, {
              text,
              reviewed: false,
            });
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Label
          htmlFor={`${id}-speaker`}
          className="text-sm text-muted-foreground"
        >
          Speaker
        </Label>
        <Select
          value={excerpt.speakerId}
          disabled={!editable}
          onValueChange={(speakerId) =>
            actions.updateExcerpt(memory.id, excerpt.id, {
              speakerId,
              reviewed: false,
            })
          }
        >
          <SelectTrigger id={`${id}-speaker`} className="h-11 w-44 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {memory.peopleIds.map((pid) => (
              <SelectItem key={pid} value={pid}>
                {personById(state, pid).name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {editable && (
          <div className="ml-auto flex gap-1">
            <Button
              size="default"
              variant={excerpt.reviewed ? "ghost" : "secondary"}
              aria-pressed={excerpt.reviewed}
              onClick={() =>
                actions.updateExcerpt(memory.id, excerpt.id, {
                  reviewed: !excerpt.reviewed,
                })
              }
            >
              {excerpt.reviewed ? "Mark as needing review" : "Mark reviewed"}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Remove excerpt at ${formatDuration(excerpt.startSec)}`}
              onClick={() => actions.removeExcerpt(memory.id, excerpt.id)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

/** Typed while listening or watching locally. No transcription service. */
function ManualExcerptForm({
  memory,
  state,
}: {
  memory: Memory;
  state: PrototypeState;
}) {
  const duration = memory.media?.durationSec;
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [speakerId, setSpeakerId] = useState(state.viewerId);
  const [text, setText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [tried, setTried] = useState(false);
  const [saved, setSaved] = useState(false);

  const startSec = parseTime(start);
  const endSec = parseTime(end);
  const errors: string[] = [];
  if (startSec === null) errors.push("Enter the start time as m:ss.");
  if (endSec === null) errors.push("Enter the end time as m:ss.");
  if (startSec !== null && endSec !== null && endSec <= startSec)
    errors.push("The end time must be after the start time.");
  if (
    duration !== undefined &&
    ((startSec ?? 0) > duration || (endSec ?? 0) > duration)
  )
    errors.push(
      `Times must be within the recording (${formatDuration(duration)}).`,
    );
  if (!memory.peopleIds.includes(speakerId))
    errors.push("Choose a speaker declared in this memory.");
  if (!text.trim()) errors.push("Type what was said.");
  if (codePoints(text) > LIMITS.captionChars)
    errors.push(`Keep an excerpt under ${LIMITS.captionChars} characters.`);
  if (!confirmed) errors.push("Confirm the wording and attribution.");

  function submit(event: FormEvent) {
    event.preventDefault();
    setTried(true);
    setSaved(false);
    if (errors.length || startSec === null || endSec === null) return;
    actions.addManualExcerpt(memory.id, {
      startSec,
      endSec,
      speakerId,
      text: text.trim(),
    });
    setStart("");
    setEnd("");
    setText("");
    setConfirmed(false);
    setTried(false);
    setSaved(true);
  }

  const fid = `manual-excerpt-${memory.id}`;
  return (
    <form
      onSubmit={submit}
      noValidate
      aria-labelledby={`${fid}-heading`}
      className="space-y-3 rounded-2xl bg-card p-4 ring-1 ring-border"
    >
      <div>
        <h4 id={`${fid}-heading`} className="text-sm font-semibold">
          Type an excerpt
        </h4>
        <p className="mt-1 text-sm text-muted-foreground">
          Listen or watch on this device and type the words yourself. Nothing is
          sent to a model.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={`${fid}-start`}>Start</Label>
          <Input
            id={`${fid}-start`}
            inputMode="numeric"
            placeholder="0:03"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            aria-invalid={tried && startSec === null}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${fid}-end`}>End</Label>
          <Input
            id={`${fid}-end`}
            inputMode="numeric"
            placeholder="0:11"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            aria-invalid={tried && endSec === null}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`${fid}-speaker`}>Speaker</Label>
          <Select value={speakerId} onValueChange={setSpeakerId}>
            <SelectTrigger id={`${fid}-speaker`} className="w-full">
              <SelectValue placeholder="Choose a speaker" />
            </SelectTrigger>
            <SelectContent>
              {memory.peopleIds.map((pid) => (
                <SelectItem key={pid} value={pid}>
                  {personById(state, pid).name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${fid}-text`}>What was said</Label>
        <Textarea
          id={`${fid}-text`}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <label
        htmlFor={`${fid}-confirm`}
        className="flex items-start gap-2 text-sm"
      >
        <Checkbox
          id={`${fid}-confirm`}
          checked={confirmed}
          onCheckedChange={(v) => setConfirmed(v === true)}
          className="mt-0.5"
        />
        I confirm this wording and attribution
      </label>
      {tried && errors.length > 0 && (
        <ul
          role="alert"
          className="list-disc space-y-0.5 pl-4 text-sm text-destructive"
        >
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit">
          <Plus aria-hidden="true" /> Add excerpt
        </Button>
        {saved && (
          <span role="status" className="text-sm text-muted-foreground">
            Excerpt added and marked reviewed.
          </span>
        )}
      </div>
    </form>
  );
}

function Derivatives({
  memory,
  state,
}: {
  memory: Memory;
  state: PrototypeState;
}) {
  const approvers = approverIds(memory);
  const isUploader = memory.uploaderId === state.viewerId;
  // Uploader always; declared people once the memory is approved for manual use.
  const editable =
    isUploader ||
    (approvers.includes(state.viewerId) && manualEligible(memory));
  const transcriberApproved =
    memory.requestedProcessors.includes("transcriber") &&
    approvers.every(
      (id) => memory.decisions[id]?.processors.transcriber === "approved",
    );
  const aiOn = state.aiConfig.enabled;
  const hasAudio = memory.kind === "voice" || memory.kind === "video";
  const hasStills = !!memory.stills?.length;
  if (!hasAudio && !hasStills) return null;
  const transcript = memory.transcript ?? [];
  const transcriptChars = transcript.reduce(
    (n, e) => n + codePoints(e.text),
    0,
  );
  const selectedStills = (memory.stills ?? []).filter((s) => s.selected).length;

  const aiStatus = !aiOn
    ? {
        icon: PowerOff,
        title: "Automatic transcription is off",
        body: "Type excerpts while listening; no model is used.",
      }
    : !transcriberApproved
      ? {
          icon: Clock3,
          title: "Automatic transcription waits for permission",
          body: memory.requestedProcessors.includes("transcriber")
            ? "No audio is sent to the transcriber until everyone in this memory approves it. You can still type excerpts by hand."
            : "Transcription wasn’t requested for this version. Type excerpts by hand, or revise the memory to ask for it.",
        }
      : null;

  return (
    <section aria-labelledby="derivatives-heading" className="space-y-5">
      <div>
        <h2
          id="derivatives-heading"
          className="text-lg font-semibold tracking-tight"
        >
          Quotes and stills from this memory
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bounded, reviewable pieces for the photozine. They inherit this
          memory’s permissions and are discarded if anyone withdraws.
        </p>
      </div>

      {hasAudio && (
        <div className="space-y-3">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
            <Mic className="size-4" aria-hidden="true" /> Excerpts
          </h3>
          {aiStatus && (
            <div className="flex gap-3 rounded-lg bg-card ring-1 ring-border p-3 text-sm">
              <aiStatus.icon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">{aiStatus.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {aiStatus.body}
                </p>
              </div>
            </div>
          )}
          <BudgetMeter
            label="Excerpt length for this recording"
            used={transcriptChars}
            limit={LIMITS.transcriptChars}
          />
          {transcript.length > 0 ? (
            <ul className="space-y-2">
              {transcript.map((ex) => (
                <ExcerptRow
                  key={`${ex.id}-${ex.text}`}
                  memory={memory}
                  excerpt={ex}
                  state={state}
                  editable={editable}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No excerpts yet.</p>
          )}
          {editable ? (
            <ManualExcerptForm memory={memory} state={state} />
          ) : (
            <p className="text-sm text-muted-foreground">
              The uploader and the people in this memory can add excerpts once
              it’s approved for manual use.
            </p>
          )}
          <TrustNote>
            Speakers come from the uploader’s declarations. Chorus doesn’t
            identify voices automatically. Fixing a typo is fine. If a
            correction changes what someone meant, publish a new source version
            so everyone can review it again.
          </TrustNote>
        </div>
      )}

      {hasStills && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
              <Film className="size-4" aria-hidden="true" /> Video stills
            </h3>
            <span className="text-sm text-muted-foreground">
              {selectedStills} of {memory.stills!.length} selected · up to{" "}
              {LIMITS.framesPerVideo} per clip
            </span>
          </div>
          <p className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Laptop className="size-3.5" aria-hidden="true" />
            Picked on this device, no AI.
          </p>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {memory.stills!.slice(0, LIMITS.framesPerVideo).map((still) => (
              <li key={still.id}>
                <button
                  type="button"
                  disabled={!editable}
                  aria-pressed={still.selected}
                  aria-label={`Still at ${formatDuration(still.atSec)}, ${still.selected ? "selected" : "not selected"}`}
                  onClick={() => actions.toggleStill(memory.id, still.id)}
                  className={cn(
                    "relative block w-full overflow-hidden rounded-lg border-2 text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default",
                    still.selected
                      ? "border-primary"
                      : "border-transparent opacity-70",
                  )}
                >
                  <ArtworkFill art={still.art} className="aspect-video" />
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
                    {still.selected ? (
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                    ) : (
                      <Circle className="size-3" aria-hidden="true" />
                    )}
                    {still.selected ? "Selected" : "Not used"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <TrustNote>
            Stills are extracted on your device and can be placed in a template
            without any AI. The full raw video is never sent to AI. If AI is on
            and approved, only the selected stills, resized to 1280 px, go to
            the visual analyst.
          </TrustNote>
        </div>
      )}
    </section>
  );
}

function ApprovalGlyph({ memory, id }: { memory: Memory; id: string }) {
  const d = memory.decisions[id];
  const glyph: "approved" | "declined" | "waiting" | "draft" = !memory.submitted
    ? "draft"
    : d?.editRequested
      ? "waiting"
      : d?.manual === "approved"
        ? "approved"
        : d?.manual === "declined"
          ? "declined"
          : "waiting";
  const label = {
    approved: "Approved",
    declined: "Declined",
    waiting: "Waiting",
    draft: "Not asked yet",
  }[glyph];
  return (
    <span
      className={cn(
        "absolute -right-0.5 -bottom-0.5 grid size-5 place-items-center rounded-full ring-2 ring-card",
        glyph === "approved" && "bg-primary text-primary-foreground",
        glyph === "declined" && "bg-destructive text-white",
        (glyph === "waiting" || glyph === "draft") &&
          "bg-muted text-muted-foreground",
      )}
    >
      {glyph === "approved" ? (
        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
      ) : glyph === "declined" ? (
        <X className="size-3" strokeWidth={3} aria-hidden="true" />
      ) : (
        <Clock3 className="size-3" aria-hidden="true" />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function MemoryDetail({
  collectionId,
  memoryId,
}: {
  collectionId: string;
  memoryId: string;
}) {
  const state = usePrototype();
  return state.collections.some((c) => c.id === collectionId) ? (
    <PrototypeMemoryDetail collectionId={collectionId} memoryId={memoryId} />
  ) : (
    <ConvexMemoryDetail collectionId={collectionId} memoryId={memoryId} />
  );
}

function PrototypeMemoryDetail({
  collectionId,
  memoryId,
}: {
  collectionId: string;
  memoryId: string;
}) {
  const state = usePrototype();
  const memory = state.memories.find(
    (m) => m.id === memoryId && m.collectionId === collectionId,
  );
  const backLink = (
    <Link
      to="/collections/$collectionId"
      params={{ collectionId }}
      className="inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" /> Back to the zine
    </Link>
  );

  const isUploader = memory?.uploaderId === state.viewerId;
  if (!memory || (!memory.submitted && !isUploader))
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        {backLink}
        <EmptyState
          icon={<Lock className="size-5" aria-hidden="true" />}
          title="This memory isn’t available"
        >
          It may be a private draft or may have been removed.
        </EmptyState>
      </div>
    );

  const status = memoryStatus(memory);
  const approvers = approverIds(memory);
  const isApprover = approvers.includes(state.viewerId);
  const pendingIds = pendingApproverIds(memory);
  const viewerPending = pendingIds.includes(state.viewerId);
  // Uploader and assigned approvers hold a review grant; others need full release.
  const canPreview = isUploader || isApprover || manualEligible(memory);
  const uploader = personById(state, memory.uploaderId);
  const waitingNames = pendingIds
    .map((id) => personById(state, id).name.split(" ")[0])
    .join(", ");

  let primary: ReactNode = null;
  if (isUploader && !memory.submitted)
    primary = (
      <Button
        size="lg"
        variant="highlight"
        onClick={() => actions.submitMemory(memory.id)}
      >
        <Send aria-hidden="true" /> Submit for approval
      </Button>
    );
  else if (isApprover && memory.submitted && viewerPending)
    primary = (
      <Button asChild size="lg" variant="highlight">
        <Link to="/approvals/$memoryId" params={{ memoryId: memory.id }}>
          <ShieldCheck aria-hidden="true" /> Review
        </Link>
      </Button>
    );
  else if (isUploader) primary = <ReviseDialog memory={memory} state={state} />;

  return (
    <div className="mx-auto w-full max-w-2xl animate-in space-y-5 duration-300 fade-in-0 slide-in-from-bottom-2">
      <div className="flex items-center justify-between gap-2">
        {backLink}
        {isApprover && memory.submitted && !viewerPending && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link
                  to="/approvals/$memoryId"
                  params={{ memoryId: memory.id }}
                >
                  Change my decision
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {canPreview ? (
        <figure className="rise overflow-hidden rounded-[2rem] bg-card shadow-lift ring-1 ring-border">
          <MediaPreview
            memory={memory}
            className={
              memory.kind === "text"
                ? "min-h-48 p-6"
                : "aspect-4/3 rounded-[2rem]"
            }
          />
        </figure>
      ) : (
        <div className="flex aspect-4/3 flex-col items-center justify-center gap-3 rounded-[2rem] bg-muted p-6 ring-1 ring-border text-center">
          <span className="grid size-14 -rotate-3 place-items-center rounded-full bg-lime text-lime-ink">
            <Lock className="size-6" aria-hidden="true" />
          </span>
          <p className="font-medium">Locked until everyone approves</p>
        </div>
      )}

      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {canPreview ? memory.title : "Memory without your access"}
        </h1>
        {canPreview && memory.caption && (
          <p className="text-base text-muted-foreground">{memory.caption}</p>
        )}
        {canPreview && memory.kind === "text" && memory.story && (
          <p className="text-base leading-relaxed whitespace-pre-line">
            {memory.story}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <MemoryStatusBadge status={status} />
        </div>
      </div>

      {status === "awaiting" && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl bg-accent p-4 text-accent-foreground"
        >
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="text-base">
            {waitingNames ? `Waiting for ${waitingNames}.` : "Waiting."} Nobody
            can open this yet.
          </p>
        </div>
      )}

      <section aria-labelledby="people-heading" className="space-y-2">
        <h2 id="people-heading" className="text-sm font-medium">
          Who&apos;s in this
        </h2>
        <ul className="flex flex-wrap gap-4">
          {approvers.map((id) => {
            const person = personById(state, id);
            return (
              <li key={id} className="flex w-14 flex-col items-center gap-1">
                <span className="relative">
                  <PersonAvatar person={person} size="lg" />
                  <ApprovalGlyph memory={memory} id={id} />
                </span>
                <span className="w-full truncate text-center text-sm">
                  {id === state.viewerId ? "You" : person.name.split(" ")[0]}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {primary && <ActionBar className="md:justify-start">{primary}</ActionBar>}

      <Disclosure summary="Details">
        <p>
          Added by {uploader.id === state.viewerId ? "you" : uploader.name}.{" "}
          {memoryStatusHint(status)}
        </p>
        {canPreview && memory.kind !== "text" && memory.story && (
          <p className="leading-relaxed">{memory.story}</p>
        )}
        {memory.kind === "voice" && canPreview && (
          <p>Audio playback is simulated in this prototype.</p>
        )}
        {memory.media && canPreview && (
          <dl className="tabular grid grid-cols-2 gap-x-4 gap-y-2">
            <div>
              <dt>Format</dt>
              <dd className="font-medium text-foreground">
                {memory.media.codec ?? memory.media.mime}
              </dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd className="font-medium text-foreground">
                {formatBytes(memory.media.sizeBytes)}
              </dd>
            </div>
            {memory.media.durationSec !== undefined && (
              <div>
                <dt>Length</dt>
                <dd className="font-medium text-foreground">
                  {formatDuration(memory.media.durationSec)}
                </dd>
              </div>
            )}
            {memory.media.width && (
              <div>
                <dt>Dimensions</dt>
                <dd className="font-medium text-foreground">
                  {memory.media.width}×{memory.media.height}
                </dd>
              </div>
            )}
          </dl>
        )}
        {memory.submitted && (
          <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-border">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                Decisions on version {memory.version}
              </caption>
              <thead className="text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Person
                  </th>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Use in the zine
                  </th>
                  {memory.requestedProcessors.map((p) => (
                    <th key={p} scope="col" className="px-3 py-2 font-medium">
                      {processorShort[p] ?? p}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {approvers.map((id) => {
                  const person = personById(state, id);
                  const d = memory.decisions[id];
                  return (
                    <tr key={id}>
                      <th scope="row" className="px-3 py-2 font-normal">
                        {id === state.viewerId
                          ? "You"
                          : person.name.split(" ")[0]}
                      </th>
                      <td className="px-3 py-2">
                        {d?.editRequested ? (
                          <DecisionBadge
                            decision="pending"
                            label="Edit requested"
                          />
                        ) : (
                          <DecisionBadge decision={d?.manual ?? "pending"} />
                        )}
                      </td>
                      {memory.requestedProcessors.map((p) => (
                        <td key={p} className="px-3 py-2">
                          {!d?.editRequested && (
                            <DecisionBadge
                              decision={d?.processors[p] ?? "pending"}
                            />
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Disclosure>

      <Disclosure summary="Versions">
        <ol className="space-y-2">
          {[...memory.versions].reverse().map((v) => (
            <li
              key={v.version}
              className="flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-border"
            >
              <span className="tabular font-medium text-foreground">
                v{v.version}
              </span>
              <span className="min-w-0 flex-1">{v.note}</span>
              <time dateTime={v.createdAt}>{formatWhen(v.createdAt)}</time>
              {v.version === memory.version && (
                <Badge variant="secondary">Current</Badge>
              )}
            </li>
          ))}
        </ol>
      </Disclosure>

      {canPreview && (
        <Disclosure summary="Quotes and stills">
          <Derivatives memory={memory} state={state} />
        </Disclosure>
      )}
    </div>
  );
}
