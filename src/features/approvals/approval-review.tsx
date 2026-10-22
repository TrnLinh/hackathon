import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Cpu,
  Fingerprint,
  Loader2,
  Pause,
  PenLine,
  Play,
  ShieldAlert,
  UserRoundX,
  X,
} from "lucide-react";
import { kindMeta, MemoryThumb } from "@/components/chorus/memory-thumb";
import { PersonAvatar } from "@/components/chorus/people";
import {
  EmptyState,
  PageHeader,
  TrustNote,
} from "@/components/chorus/page-header";
import { DecisionBadge, MemoryStatusBadge } from "@/components/chorus/status";
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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { actions, usePrototype } from "@/features/prototype/store";
import {
  approverIds,
  formatBytes,
  formatDuration,
  formatWhen,
  memoryStatus,
  personById,
} from "@/features/prototype/selectors";
import type {
  ApproverDecisions,
  Memory,
  Processor,
  ProcessorId,
  PrototypeState,
} from "@/features/prototype/types";
import { DecisionSummary } from "./decision-summary";
import { WithdrawDialog } from "./withdraw-dialog";

type Choice = "approved" | "declined" | undefined;

/** Synthetic commitment for display. Not a real hash. */
function commitment(memory: Memory) {
  const seed = `${memory.id}:${memory.version}:${memory.title}:${memory.caption}:${memory.story}:${memory.peopleIds.join(",")}`;
  let h = 0x811c9dc5;
  let out = "";
  for (let round = 0; round < 8; round++) {
    for (let i = 0; i < seed.length; i++) {
      h ^= seed.charCodeAt(i) + round;
      h = Math.imul(h, 16777619);
    }
    out += (h >>> 0).toString(16).padStart(8, "0");
  }
  return out;
}

function FakePlayer({
  memory,
  overlay,
}: {
  memory: Memory;
  overlay?: boolean;
}) {
  const duration = memory.media?.durationSec ?? 30;
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setTime((t) => {
        if (t + 1 >= duration) {
          setPlaying(false);
          return duration;
        }
        return t + 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [playing, duration]);
  const label = memory.kind === "video" ? "video" : "voice note";
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2",
        overlay ? "bg-black/55 text-white backdrop-blur-sm" : "border bg-card",
      )}
    >
      <Button
        size="icon-sm"
        variant="secondary"
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        onClick={() => {
          if (time >= duration) setTime(0);
          setPlaying((p) => !p);
        }}
      >
        {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
      </Button>
      <div
        className={cn(
          "h-1.5 flex-1 overflow-hidden rounded-full",
          overlay ? "bg-white/30" : "bg-muted",
        )}
        aria-hidden="true"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            overlay ? "bg-white" : "bg-primary",
          )}
          style={{ width: `${(time / duration) * 100}%` }}
        />
      </div>
      <span
        className={cn(
          "font-mono text-xs tabular-nums",
          overlay ? "text-white/85" : "text-muted-foreground",
        )}
      >
        {formatDuration(time)} / {formatDuration(duration)}
      </span>
    </div>
  );
}

function ExactVersion({
  state,
  memory,
}: {
  state: PrototypeState;
  memory: Memory;
}) {
  const uploader = personById(state, memory.uploaderId);
  const people = approverIds(memory).map((id) => personById(state, id));
  const speakers = new Set((memory.transcript ?? []).map((e) => e.speakerId));
  const versionInfo = memory.versions.find((v) => v.version === memory.version);
  const KindIcon = kindMeta[memory.kind].icon;
  return (
    <section
      aria-labelledby="exact-heading"
      className="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="exact-heading" className="text-base font-semibold">
          The exact version you’re deciding on
        </h2>
        <MemoryStatusBadge status={memoryStatus(memory)} />
      </div>
      {memory.kind === "video" ? (
        <div className="relative mx-auto aspect-video w-full max-w-xl overflow-hidden rounded-lg bg-black">
          <MemoryThumb memory={memory} className="absolute inset-0" />
          <div className="absolute inset-x-2 bottom-2">
            <FakePlayer memory={memory} overlay />
          </div>
        </div>
      ) : (
        <MemoryThumb
          memory={memory}
          className={cn(
            "w-full rounded-lg",
            memory.kind === "text" && "min-h-40",
            memory.kind === "voice" && "h-28",
            memory.kind === "photo" && "mx-auto aspect-[4/3] max-w-xl",
          )}
        />
      )}
      {memory.kind === "voice" && <FakePlayer memory={memory} />}
      <p className="text-xs text-muted-foreground">
        Protected preview. Only the people asked to decide can open it before
        everyone approves; no processor receives anything during this review.
      </p>

      <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Type</dt>
          <dd className="inline-flex items-center gap-1.5">
            <KindIcon className="size-4" aria-hidden="true" />
            {kindMeta[memory.kind].label}
            {memory.media && (
              <span className="text-muted-foreground">
                · {formatBytes(memory.media.sizeBytes)}
                {memory.media.durationSec
                  ? ` · ${memory.media.durationSec}s`
                  : ""}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Version</dt>
          <dd>
            Version {memory.version}
            {versionInfo && (
              <span className="text-muted-foreground">
                {" "}
                · {formatWhen(versionInfo.createdAt)}
              </span>
            )}
          </dd>
          {versionInfo && (
            <dd className="text-xs text-muted-foreground">
              {versionInfo.note}
            </dd>
          )}
        </div>
        <div className="sm:col-span-2">
          <dt className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Fingerprint className="size-3.5" aria-hidden="true" /> Content
            commitment (synthetic)
          </dt>
          <dd className="font-mono text-xs break-all">
            sha256:{commitment(memory)}
          </dd>
        </div>
        {memory.caption && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Caption</dt>
            <dd className="italic">“{memory.caption}”</dd>
          </div>
        )}
        {memory.story && (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Story</dt>
            <dd className="leading-relaxed whitespace-pre-line">
              {memory.story}
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs text-muted-foreground">Uploaded by</dt>
          <dd className="mt-1 inline-flex items-center gap-2">
            <PersonAvatar person={uploader} size="sm" />
            {uploader.name}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            People declared in this memory
          </dt>
          <dd>
            <ul className="mt-1 space-y-1">
              {people.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <PersonAvatar person={p} size="sm" />
                  {p.name}
                  {p.id === state.viewerId && (
                    <span className="text-xs text-muted-foreground">(you)</span>
                  )}
                  {speakers.has(p.id) && (
                    <span className="rounded-full border px-1.5 text-[11px] text-muted-foreground">
                      speaker
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        People and speakers are declared by the uploader. Chorus doesn’t use
        face or speaker recognition.
      </p>
    </section>
  );
}

function Recipients({
  state,
  memory,
}: {
  state: PrototypeState;
  memory: Memory;
}) {
  const collection = state.collections.find(
    (c) => c.id === memory.collectionId,
  );
  const editor = collection
    ? personById(state, collection.creatorId)
    : undefined;
  return (
    <section
      aria-labelledby="recipients-heading"
      className="space-y-3 rounded-xl border bg-card p-4 sm:p-5"
    >
      <h2 id="recipients-heading" className="text-base font-semibold">
        Who would receive it
      </h2>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Named editor</dt>
          <dd className="mt-1 flex items-center gap-2">
            {editor && <PersonAvatar person={editor} size="sm" />}
            {editor?.name ?? "Unknown"}{" "}
            <span className="text-muted-foreground">(collection creator)</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">
            Private review audience
          </dt>
          <dd className="mt-1 text-muted-foreground">
            {approverIds(memory)
              .map((id) => personById(state, id).name)
              .join(", ")}
            . Other collection members only see whether it is available.
          </dd>
        </div>
      </dl>
      <h3 className="pt-2 text-sm font-medium">Everyone’s decisions so far</h3>
      <ul className="space-y-2">
        {approverIds(memory).map((id) => {
          const d = memory.decisions[id];
          const p = personById(state, id);
          return (
            <li
              key={id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <PersonAvatar person={p} size="sm" />
                {p.name}
              </span>
              {d?.editRequested ? (
                <DecisionBadge decision="pending" label="Edit requested" />
              ) : (
                <DecisionBadge decision={d?.manual ?? "pending"} />
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">
        Nobody sees a reason for a decline, because none is asked for.
      </p>
    </section>
  );
}

function ChoiceGroup({
  name,
  label,
  value,
  onChange,
  disabled,
}: {
  name: string;
  label: string;
  value: Choice;
  onChange: (v: "approved" | "declined") => void;
  disabled?: boolean;
}) {
  return (
    <RadioGroup
      aria-label={label}
      value={value ?? ""}
      onValueChange={(v) => onChange(v as "approved" | "declined")}
      disabled={disabled}
      className="grid-cols-2 gap-2"
    >
      {(["approved", "declined"] as const).map((v) => {
        const approve = v === "approved";
        const Icon = approve ? Check : X;
        return (
          <Label
            key={v}
            htmlFor={`${name}-${v}`}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 font-normal transition-colors hover:bg-muted/50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60",
              approve
                ? "has-[[data-state=checked]]:border-[var(--status-available)] has-[[data-state=checked]]:bg-[color-mix(in_srgb,var(--status-available)_10%,transparent)] has-[[data-state=checked]]:text-[var(--status-available)]"
                : "has-[[data-state=checked]]:border-[var(--status-excluded)] has-[[data-state=checked]]:bg-[color-mix(in_srgb,var(--status-excluded)_8%,transparent)] has-[[data-state=checked]]:text-[var(--status-excluded)]",
            )}
          >
            <RadioGroupItem
              id={`${name}-${v}`}
              value={v}
              className={
                approve
                  ? "data-checked:border-[var(--status-available)] data-checked:bg-[var(--status-available)]"
                  : "data-checked:border-[var(--status-excluded)] data-checked:bg-[var(--status-excluded)]"
              }
            />
            <span className="flex-1">{approve ? "Approve" : "Decline"}</span>
            {value === v && <Icon className="size-4" aria-hidden="true" />}
          </Label>
        );
      })}
    </RadioGroup>
  );
}

function ProcessorCard({
  processor,
  value,
  onChange,
  disabled,
}: {
  processor: Processor;
  value: Choice;
  onChange: (v: "approved" | "declined") => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="inline-flex items-center gap-1.5 text-sm font-medium">
            <Cpu className="size-4" aria-hidden="true" />
            {processor.name}
          </p>
          <p className="text-xs text-muted-foreground">{processor.role}</p>
        </div>
        {!value && <DecisionBadge decision="pending" />}
      </div>
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Would receive only</dt>
          <dd>
            <ul className="list-disc pl-4">
              {processor.receives.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Model and runtime</dt>
          <dd>
            {processor.model}; {processor.runtime}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Retention</dt>
          <dd>{processor.retention}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        Hosted by the team, but the model and privileged cloud operators can
        still see what it receives. Once sent, content cannot be recalled.
      </p>
      <ChoiceGroup
        name={`proc-${processor.id}`}
        label={`Decision for ${processor.name}`}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

function RequestEditDialog({
  memory,
  uploaderName,
}: {
  memory: Memory;
  uploaderName: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PenLine aria-hidden="true" /> Request an edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request an edit</DialogTitle>
          <DialogDescription>
            {uploaderName} can publish a new version. Any change needs fresh
            approval from everyone; this version stays undecided for you.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="edit-note">
            Private note to {uploaderName} (optional)
          </Label>
          <Textarea
            id="edit-note"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Could you crop me out, or remove the last sentence?"
          />
          <p className="text-xs text-muted-foreground">
            Only {uploaderName} sees this. Prototype: the note itself isn’t
            saved.
          </p>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            disabled={pending}
            onClick={() => {
              setPending(true);
              window.setTimeout(() => {
                actions.requestEdit(memory.id);
                setPending(false);
                setOpen(false);
                setNote("");
              }, 600);
            }}
          >
            {pending ? "Sending…" : "Send request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function initialChoice(d: ApproverDecisions["manual"] | undefined): Choice {
  return d === "approved" || d === "declined" ? d : undefined;
}

function DecisionForm({
  state,
  memory,
}: {
  state: PrototypeState;
  memory: Memory;
}) {
  const existing = memory.decisions[state.viewerId];
  const [manual, setManual] = useState<Choice>(
    existing?.editRequested ? undefined : initialChoice(existing?.manual),
  );
  const [procs, setProcs] = useState<Partial<Record<ProcessorId, Choice>>>(
    () =>
      existing?.editRequested
        ? {}
        : Object.fromEntries(
            memory.requestedProcessors.map((p) => [
              p,
              initialChoice(existing?.processors[p]),
            ]),
          ),
  );
  const [phase, setPhase] = useState<"idle" | "submitting" | "committed">(
    "idle",
  );
  const [showMissing, setShowMissing] = useState(false);
  const inFlight = useRef(false);

  const processors = memory.requestedProcessors
    .map((id) => state.processors.find((p) => p.id === id))
    .filter((p): p is Processor => Boolean(p));
  const manualDeclined = manual === "declined";
  const effective = (id: ProcessorId): Choice =>
    manualDeclined ? "declined" : procs[id];

  const missing = [
    ...(manual ? [] : ["Manual composition and private review"]),
    ...processors.filter((p) => !effective(p.id)).map((p) => p.name),
  ];
  const aiDeclined = processors.some((p) => effective(p.id) === "declined");

  function submit() {
    if (inFlight.current) return;
    if (missing.length) {
      setShowMissing(true);
      return;
    }
    inFlight.current = true;
    setPhase("submitting");
    window.setTimeout(() => {
      actions.decide(memory.id, {
        manual: manual!,
        processors: Object.fromEntries(
          processors.map((p) => [p.id, effective(p.id)!]),
        ),
      });
      inFlight.current = false;
      setPhase("committed");
    }, 600);
  }

  const uploader = personById(state, memory.uploaderId);

  if (phase === "committed") {
    const saved = memory.decisions[state.viewerId];
    return (
      <div role="status" className="space-y-4 rounded-xl border bg-card p-5">
        <p className="inline-flex items-center gap-2 font-medium text-[var(--status-available)]">
          <CheckCircle2 className="size-5" aria-hidden="true" />
          Decision recorded for version {memory.version}
        </p>
        <DecisionSummary
          memory={memory}
          decision={saved}
          processors={state.processors}
        />
        <p className="text-sm text-muted-foreground">
          The memory is now{" "}
          <strong className="font-medium">{memoryStatusLabel(memory)}</strong>{" "}
          for the collection. You can change or withdraw this decision later.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link
              to="/collections/$collectionId/memories/$memoryId"
              params={{
                collectionId: memory.collectionId,
                memoryId: memory.id,
              }}
            >
              Open the memory
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/approvals">Back to approvals</Link>
          </Button>
          <Button variant="ghost" onClick={() => setPhase("idle")}>
            Change again
          </Button>
        </div>
      </div>
    );
  }

  const submitting = phase === "submitting";
  return (
    <form
      className="space-y-5"
      aria-busy={submitting}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <fieldset
        disabled={submitting}
        className="space-y-3 rounded-xl border bg-card p-4 sm:p-5"
      >
        <legend className="sr-only">
          Manual composition and private review
        </legend>
        <div>
          <h2 className="text-base font-semibold">
            1. Manual composition and private review
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            May the named editor place this exact version in the draft
            photozine, and may the review audience see it? This does not allow
            any AI processing and is not approval of a final edition.
          </p>
        </div>
        <ChoiceGroup
          name="manual"
          label="Manual composition and private review"
          value={manual}
          onChange={setManual}
        />
      </fieldset>

      {processors.length > 0 && (
        <fieldset
          disabled={submitting}
          className="space-y-3 rounded-xl border bg-card p-4 sm:p-5"
        >
          <legend className="sr-only">AI processing</legend>
          <div>
            <h2 className="text-base font-semibold">
              2. AI processing, decided separately
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Each processor needs its own permission. You can approve manual
              use and decline every processor.
            </p>
          </div>
          {manualDeclined && (
            <p className="flex items-start gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <UserRoundX
                className="mt-0.5 size-3.5 shrink-0"
                aria-hidden="true"
              />
              Declining manual use also declines every processor. Nothing from
              this memory will be used.
            </p>
          )}
          {processors.map((p) => (
            <ProcessorCard
              key={p.id}
              processor={p}
              value={effective(p.id)}
              disabled={manualDeclined}
              onChange={(v) => setProcs((prev) => ({ ...prev, [p.id]: v }))}
            />
          ))}
          {manual === "approved" && aiDeclined && (
            <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
              With a processor declined, this memory becomes{" "}
              <strong className="font-medium">manual use only</strong>. The
              editor can still place it by hand, but it won’t be sent to AI or
              influence an AI-generated style.
            </p>
          )}
        </fieldset>
      )}

      {showMissing && missing.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-[var(--status-awaiting)]/40 p-3 text-sm"
        >
          <p className="font-medium">Decide each item before submitting:</p>
          <ul className="mt-1 list-disc pl-5 text-muted-foreground">
            {missing.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" /> Recording…
            </>
          ) : (
            "Submit decision"
          )}
        </Button>
        {memory.uploaderId === state.viewerId ? (
          <Button asChild variant="outline">
            <Link
              to="/collections/$collectionId/memories/$memoryId"
              params={{
                collectionId: memory.collectionId,
                memoryId: memory.id,
              }}
            >
              <PenLine aria-hidden="true" /> Edit your memory
            </Link>
          </Button>
        ) : (
          <RequestEditDialog
            memory={memory}
            uploaderName={uploader.name.split(" ")[0]}
          />
        )}
        <span role="status" className="text-xs text-muted-foreground">
          {submitting
            ? "Recording your decision. Don’t close this page."
            : missing.length
              ? `${missing.length} item${missing.length === 1 ? "" : "s"} not decided`
              : "Ready to submit"}
        </span>
      </div>
    </form>
  );
}

function memoryStatusLabel(memory: Memory) {
  return {
    private: "a private draft",
    awaiting: "awaiting permission",
    available: "available",
    "manual-only": "manual use only",
    excluded: "excluded",
  }[memoryStatus(memory)];
}

export function ApprovalReview({ memoryId }: { memoryId: string }) {
  const state = usePrototype();
  const memory = state.memories.find((m) => m.id === memoryId);
  const back = (
    <Link
      to="/approvals"
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" /> Approvals
    </Link>
  );

  if (!memory || !memory.submitted)
    return (
      <div className="space-y-6">
        {back}
        <EmptyState
          icon={<ShieldAlert className="size-5" aria-hidden="true" />}
          title="This request isn’t available"
        >
          It may have been replaced by a newer version, or it hasn’t been
          submitted for approval.
        </EmptyState>
      </div>
    );

  if (!approverIds(memory).includes(state.viewerId))
    return (
      <div className="space-y-6">
        {back}
        <EmptyState
          icon={<ShieldAlert className="size-5" aria-hidden="true" />}
          title="You are not asked to decide on this memory"
        >
          Only the uploader and the people declared in a memory can review it
          before everyone approves.
        </EmptyState>
      </div>
    );

  const collection = state.collections.find(
    (c) => c.id === memory.collectionId,
  );
  const existing = memory.decisions[state.viewerId];
  const hasDecision =
    existing && (existing.manual !== "pending" || existing.editRequested);
  const canWithdraw =
    existing?.manual === "approved" ||
    memory.requestedProcessors.some(
      (p) => existing?.processors[p] === "approved",
    );

  return (
    <div className="space-y-6">
      {back}
      <PageHeader
        eyebrow={collection?.title}
        title={memory.title}
        description="Review the exact material, who would receive it, and each proposed use. You can decline without giving a reason."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-6">
          <ExactVersion state={state} memory={memory} />
          <Recipients state={state} memory={memory} />
        </div>
        <div className="space-y-6">
          {hasDecision && (
            <section
              aria-labelledby="current-heading"
              className="space-y-3 rounded-xl border bg-secondary/40 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="current-heading" className="text-base font-semibold">
                  Your current decision
                </h2>
                {canWithdraw && <WithdrawDialog memory={memory} />}
              </div>
              <DecisionSummary
                memory={memory}
                decision={existing}
                processors={state.processors}
              />
              {existing?.decidedAt && (
                <p className="text-xs text-muted-foreground">
                  Recorded {formatWhen(existing.decidedAt)}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Changing it below records a new decision; earlier history is
                kept.
              </p>
            </section>
          )}
          <DecisionForm
            key={`${memory.id}:${memory.version}:${state.viewerId}`}
            state={state}
            memory={memory}
          />
          <TrustNote>
            This decision covers composing and privately reviewing this version.
            Approving a final, downloadable edition is a separate step later.
            Prototype: decisions are stored in this browser and do not yet
            perform Tide-protected release.
          </TrustNote>
        </div>
      </div>
    </div>
  );
}
