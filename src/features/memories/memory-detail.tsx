import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  Film,
  Lock,
  Mic,
  PenLine,
  Send,
  ShieldCheck,
} from "lucide-react";
import {
  ArtworkFill,
  kindMeta,
  MemoryThumb,
} from "@/components/chorus/memory-thumb";
import { EmptyState, TrustNote } from "@/components/chorus/page-header";
import { PersonAvatar } from "@/components/chorus/people";
import {
  DecisionBadge,
  MemoryStatusBadge,
  memoryStatusHint,
} from "@/components/chorus/status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
        <Button variant="outline">
          <PenLine aria-hidden="true" /> Revise
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
          className="rounded-lg border border-[color-mix(in_srgb,var(--status-awaiting)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-awaiting)_8%,transparent)] p-3 text-xs leading-relaxed"
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
    <li className="space-y-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="font-mono">
          {formatDuration(excerpt.startSec)}–{formatDuration(excerpt.endSec)}
        </span>
        {excerpt.reviewed ? (
          <span className="inline-flex items-center gap-1 text-[var(--status-available)]">
            <CheckCircle2 className="size-3.5" aria-hidden="true" /> Reviewed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[var(--status-awaiting)]">
            <Circle className="size-3.5" aria-hidden="true" /> Needs review
          </span>
        )}
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
          className="text-xs text-muted-foreground"
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
          <SelectTrigger id={`${id}-speaker`} className="h-8 w-44">
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
          <Button
            size="sm"
            variant={excerpt.reviewed ? "ghost" : "secondary"}
            className="ml-auto"
            aria-pressed={excerpt.reviewed}
            onClick={() =>
              actions.updateExcerpt(memory.id, excerpt.id, {
                reviewed: !excerpt.reviewed,
              })
            }
          >
            {excerpt.reviewed ? "Mark as needing review" : "Mark reviewed"}
          </Button>
        )}
      </div>
    </li>
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
  const editable = approvers.includes(state.viewerId);
  const transcriberApproved =
    memory.requestedProcessors.includes("transcriber") &&
    approvers.every(
      (id) => memory.decisions[id]?.processors.transcriber === "approved",
    );
  const hasTranscript = memory.transcript !== undefined;
  const hasStills = !!memory.stills?.length;
  if (!hasTranscript && !hasStills) return null;
  const transcriptChars = (memory.transcript ?? []).reduce(
    (n, e) => n + codePoints(e.text),
    0,
  );
  const selectedStills = (memory.stills ?? []).filter((s) => s.selected).length;

  return (
    <section aria-labelledby="derivatives-heading" className="space-y-5">
      <div>
        <h2
          id="derivatives-heading"
          className="text-lg font-semibold tracking-tight"
        >
          AI inputs from this memory
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Bounded, reviewable derivatives. They inherit this memory’s
          permissions and are discarded if anyone withdraws.
        </p>
      </div>

      {hasTranscript && (
        <div className="space-y-3">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
            <Mic className="size-4" aria-hidden="true" /> Transcript excerpts
          </h3>
          {!transcriberApproved ? (
            <div className="flex gap-3 rounded-lg border border-dashed p-4 text-sm">
              <Clock3
                className="mt-0.5 size-4 shrink-0 text-[var(--status-awaiting)]"
                aria-hidden="true"
              />
              <div>
                <p className="font-medium">
                  Transcription waits for permission
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {memory.requestedProcessors.includes("transcriber")
                    ? "No audio is sent to the transcriber until everyone in this memory approves it. Reviewing the source doesn’t trigger transcription."
                    : "Transcription wasn’t requested for this version. Revise the memory to ask for it."}
                </p>
              </div>
            </div>
          ) : (memory.transcript ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Transcription is queued.
            </p>
          ) : (
            <>
              <BudgetMeter
                label="Transcript length"
                used={transcriptChars}
                limit={LIMITS.transcriptChars}
              />
              <ul className="space-y-2">
                {memory.transcript!.map((ex) => (
                  <ExcerptRow
                    key={`${ex.id}-${ex.text}`}
                    memory={memory}
                    excerpt={ex}
                    state={state}
                    editable={editable}
                  />
                ))}
              </ul>
              <TrustNote>
                Speakers come from the uploader’s declarations. Chorus doesn’t
                identify voices automatically. Fixing a transcription error is
                fine. If a correction changes what someone meant, publish a new
                source version so everyone can review it again.
              </TrustNote>
            </>
          )}
        </div>
      )}

      {hasStills && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
              <Film className="size-4" aria-hidden="true" /> Video stills
            </h3>
            <span className="text-xs text-muted-foreground">
              {selectedStills} of {memory.stills!.length} selected · up to{" "}
              {LIMITS.framesPerVideo} per clip
            </span>
          </div>
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
                  <span className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
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
            Stills are sampled on your device. The full raw video is never sent
            to AI. Only the selected stills, resized to {1280} px, go to the
            visual analyst after approval.
          </TrustNote>
        </div>
      )}
    </section>
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
  const memory = state.memories.find(
    (m) => m.id === memoryId && m.collectionId === collectionId,
  );
  const backLink = (
    <Link
      to="/collections/$collectionId"
      params={{ collectionId }}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" /> All memories
    </Link>
  );

  const isUploader = memory?.uploaderId === state.viewerId;
  if (!memory || (!memory.submitted && !isUploader))
    return (
      <div className="space-y-4">
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
  const viewerPending = pendingApproverIds(memory).includes(state.viewerId);
  // Uploader and assigned approvers hold a review grant; others need full release.
  const canPreview = isUploader || isApprover || manualEligible(memory);
  const uploader = personById(state, memory.uploaderId);
  const KindIcon = kindMeta[memory.kind].icon;

  return (
    <div className="space-y-8">
      {backLink}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <KindIcon className="size-3.5" aria-hidden="true" />
            {kindMeta[memory.kind].label} · version {memory.version}
          </p>
          <h2 className="font-serif text-2xl tracking-tight sm:text-3xl">
            {canPreview ? memory.title : "Memory without your access"}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <MemoryStatusBadge status={status} />
            <span className="text-xs text-muted-foreground">
              {memoryStatusHint(status)}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isUploader && !memory.submitted && (
            <Button onClick={() => actions.submitMemory(memory.id)}>
              <Send aria-hidden="true" /> Submit for approval
            </Button>
          )}
          {isUploader && <ReviseDialog memory={memory} state={state} />}
          {isApprover && memory.submitted && (
            <Button asChild variant={viewerPending ? "default" : "outline"}>
              <Link to="/approvals/$memoryId" params={{ memoryId: memory.id }}>
                <ShieldCheck aria-hidden="true" />
                {viewerPending
                  ? "Review and decide"
                  : "Change or withdraw my decision"}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {canPreview ? (
            <figure className="overflow-hidden rounded-xl border bg-card">
              <MemoryThumb
                memory={memory}
                className={
                  memory.kind === "text" ? "min-h-48 p-6" : "aspect-[4/3]"
                }
              />
              {memory.kind === "voice" && (
                <div className="border-t px-4 py-3">
                  <Button size="sm" variant="outline" disabled>
                    Play protected audio
                  </Button>
                  <span className="ml-2 text-xs text-muted-foreground">
                    Playback is simulated in the prototype.
                  </span>
                </div>
              )}
              <figcaption className="space-y-2 border-t p-4 text-sm">
                {memory.caption && <p className="italic">{memory.caption}</p>}
                {memory.story && memory.kind !== "text" && (
                  <p className="leading-relaxed text-muted-foreground">
                    {memory.story}
                  </p>
                )}
                {memory.kind === "text" && (
                  <p className="leading-relaxed whitespace-pre-line">
                    {memory.story}
                  </p>
                )}
              </figcaption>
            </figure>
          ) : (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted p-6 text-center">
              <Lock
                className="size-6 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm font-medium">Preview locked</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Released to the editor and review audience only after everyone
                in it approves.
              </p>
            </div>
          )}
          <TrustNote>
            Protected preview. In the real build, it decrypts only for the
            uploader, assigned approvers, and members with a current release.
            Anyone who sees plaintext can copy it. Here the image is a synthetic
            placeholder.
          </TrustNote>
          {memory.media && canPreview && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border bg-card p-4 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Format</dt>
                <dd className="font-medium">
                  {memory.media.codec ?? memory.media.mime}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Size</dt>
                <dd className="font-medium">
                  {formatBytes(memory.media.sizeBytes)}
                </dd>
              </div>
              {memory.media.durationSec !== undefined && (
                <div>
                  <dt className="text-muted-foreground">Length</dt>
                  <dd className="font-medium">
                    {formatDuration(memory.media.durationSec)}
                  </dd>
                </div>
              )}
              {memory.media.width && (
                <div>
                  <dt className="text-muted-foreground">Dimensions</dt>
                  <dd className="font-medium">
                    {memory.media.width}×{memory.media.height}
                  </dd>
                </div>
              )}
              <div className="col-span-2 sm:col-span-4">
                <dt className="sr-only">Preparation</dt>
                <dd className="text-muted-foreground">
                  {memory.media.sanitized
                    ? "Location metadata removed and orientation normalized (simulated)."
                    : "Not yet prepared."}
                </dd>
              </div>
            </dl>
          )}
        </div>

        <div className="space-y-6">
          <section aria-labelledby="people-heading" className="space-y-3">
            <h3 id="people-heading" className="text-sm font-semibold">
              Who decides
            </h3>
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">
                  Decisions on version {memory.version}
                </caption>
                <thead className="border-b text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Person
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Manual use
                    </th>
                    {memory.requestedProcessors.map((p) => (
                      <th key={p} scope="col" className="px-3 py-2 font-medium">
                        {processorShort[p] ?? p}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {approvers.map((id) => {
                    const person = personById(state, id);
                    const d = memory.decisions[id];
                    return (
                      <tr key={id}>
                        <th scope="row" className="px-3 py-2 font-normal">
                          <span className="flex items-center gap-2">
                            <PersonAvatar person={person} size="sm" />
                            <span className="whitespace-nowrap">
                              {id === state.viewerId
                                ? "You"
                                : person.name.split(" ")[0]}
                              {id === memory.uploaderId && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  · uploader
                                </span>
                              )}
                            </span>
                          </span>
                        </th>
                        <td className="px-3 py-2">
                          {!memory.submitted ? (
                            <Badge variant="outline">Not asked yet</Badge>
                          ) : d?.editRequested ? (
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
                            {memory.submitted && !d?.editRequested && (
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
            <p className="text-xs text-muted-foreground">
              Added by {uploader.id === state.viewerId ? "you" : uploader.name}.
              Silence never counts as consent. Decline reasons are never shown
              to others.
            </p>
          </section>

          <section aria-labelledby="versions-heading" className="space-y-3">
            <h3 id="versions-heading" className="text-sm font-semibold">
              Versions
            </h3>
            <ol className="space-y-2">
              {[...memory.versions].reverse().map((v) => (
                <li
                  key={v.version}
                  className="flex gap-3 rounded-lg border bg-card px-3 py-2 text-xs"
                >
                  <span className="font-mono font-medium">v{v.version}</span>
                  <span className="flex-1">{v.note}</span>
                  <time
                    dateTime={v.createdAt}
                    className="text-muted-foreground"
                  >
                    {formatWhen(v.createdAt)}
                  </time>
                  {v.version === memory.version && (
                    <Badge variant="secondary">Current</Badge>
                  )}
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground">
              Approvals bind one exact version. A new version starts a new
              request.
            </p>
          </section>
        </div>
      </div>

      {canPreview && <Derivatives memory={memory} state={state} />}
    </div>
  );
}
