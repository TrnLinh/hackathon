import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Loader2,
  PenLine,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { MediaPreview } from "@/components/chorus/media-preview";
import { kindMeta } from "@/components/chorus/memory-thumb";
import { PersonAvatar } from "@/components/chorus/people";
import { EmptyState } from "@/components/chorus/page-header";
import { ActionBar, Disclosure } from "@/components/chorus/primitives";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { actions, usePrototype } from "@/features/prototype/store";
import {
  approverIds,
  formatBytes,
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
import { BackendOnly, QueryBoundary } from "@/features/data/backend";
import { ApprovalNotFound, ConvexApprovalReview } from "./convex-inbox";

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

function Preview({ memory }: { memory: Memory }) {
  return (
    <div className="-mx-4 sm:mx-0">
      <MediaPreview
        memory={memory}
        className={cn(
          "w-full sm:rounded-[2rem] sm:shadow-lift",
          memory.kind === "voice"
            ? "min-h-40"
            : "aspect-[4/3] md:aspect-[16/10]",
        )}
      />
    </div>
  );
}

function PeopleRow({
  state,
  memory,
}: {
  state: PrototypeState;
  memory: Memory;
}) {
  const uploader = personById(state, memory.uploaderId);
  const others = approverIds(memory)
    .filter((id) => id !== memory.uploaderId)
    .map((id) => personById(state, id));
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="inline-flex items-center gap-2 text-base">
        <PersonAvatar person={uploader} size="md" />
        {memory.uploaderId === state.viewerId
          ? "From you"
          : `From ${uploader.name.split(" ")[0]}`}
      </span>
      {others.length > 0 && (
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          Also in it
          <span className="inline-flex -space-x-1.5">
            {others.map((p) => (
              <PersonAvatar key={p.id} person={p} size="md" />
            ))}
          </span>
        </span>
      )}
    </div>
  );
}

function DetailsBlock({
  state,
  memory,
}: {
  state: PrototypeState;
  memory: Memory;
}) {
  const versionInfo = memory.versions.find((v) => v.version === memory.version);
  const KindIcon = kindMeta[memory.kind].icon;
  const collection = state.collections.find(
    (c) => c.id === memory.collectionId,
  );
  const editor = collection
    ? personById(state, collection.creatorId)
    : undefined;
  const speakers = new Set((memory.transcript ?? []).map((e) => e.speakerId));
  const processors = memory.requestedProcessors
    .map((id) => state.processors.find((p) => p.id === id))
    .filter((p): p is Processor => Boolean(p));
  return (
    <Disclosure summary="Details">
      <p className="inline-flex items-center gap-1.5">
        <KindIcon className="size-4" aria-hidden="true" />
        {kindMeta[memory.kind].label}
        {memory.media && (
          <span>
            , {formatBytes(memory.media.sizeBytes)}
            {memory.media.durationSec ? `, ${memory.media.durationSec}s` : ""}
          </span>
        )}
      </p>
      <p>
        Version <span className="tabular">{memory.version}</span>
        {versionInfo && (
          <>
            , {formatWhen(versionInfo.createdAt)}. {versionInfo.note}
          </>
        )}
      </p>
      {memory.caption && <p className="italic">“{memory.caption}”</p>}
      {memory.story && <p className="whitespace-pre-line">{memory.story}</p>}
      {editor && <p>Editor: {editor.name}</p>}
      <p>
        Reviewers:{" "}
        {approverIds(memory)
          .map((id) => {
            const speaker = speakers.has(id) ? " (speaks)" : "";
            return personById(state, id).name + speaker;
          })
          .join(", ")}
      </p>
      {processors.length > 0 && (
        <ul className="list-disc space-y-1 pl-4">
          {processors.map((p) => (
            <li key={p.id}>
              {p.name}: {p.role}. Gets {p.receives.join(", ")}.
            </li>
          ))}
        </ul>
      )}
      <p className="font-mono text-xs break-all">
        Fingerprint {commitment(memory)}
      </p>
    </Disclosure>
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
        <Button variant="ghost">
          <PenLine aria-hidden="true" /> Ask for a change
        </Button>
      </DialogTrigger>
      <DialogContent className="rounded-3xl">
        <DialogHeader>
          <DialogTitle>Ask for a change</DialogTitle>
          <DialogDescription>
            {uploaderName} can post a new version. Everyone approves it again.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="edit-note">Note to {uploaderName} (optional)</Label>
          <Textarea
            id="edit-note"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Could you crop me out?"
          />
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
            {pending ? "Sending..." : "Send"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function initialChoice(d: ApproverDecisions["manual"] | undefined): Choice {
  return d === "approved" || d === "declined" ? d : undefined;
}

function memoryStatusLabel(memory: Memory) {
  return {
    private: "a private draft",
    awaiting: "waiting for others",
    available: "ready for the zine",
    "manual-only": "ready, without AI",
    excluded: "left out",
  }[memoryStatus(memory)];
}

function DecisionForm({
  state,
  memory,
}: {
  state: PrototypeState;
  memory: Memory;
}) {
  const existing = memory.decisions[state.viewerId];
  const fresh = Boolean(existing?.editRequested);
  const processors = memory.requestedProcessors
    .map((id) => state.processors.find((p) => p.id === id))
    .filter((p): p is Processor => Boolean(p));

  // Pre-existing per-processor state, preserved unless the person changes it.
  const prior: Partial<Record<ProcessorId, Choice>> = fresh
    ? {}
    : Object.fromEntries(
        memory.requestedProcessors.map((p) => [
          p,
          initialChoice(existing?.processors[p]),
        ]),
      );
  const [aiOn, setAiOn] = useState(
    processors.length > 0 &&
      processors.every((p) => prior[p.id] === "approved"),
  );
  const [aiTouched, setAiTouched] = useState(false);
  const [phase, setPhase] = useState<"idle" | "submitting" | "committed">(
    "idle",
  );
  const [lastChoice, setLastChoice] = useState<Choice>();
  const inFlight = useRef(false);
  const uploader = personById(state, memory.uploaderId);

  function submit(manual: "approved" | "declined") {
    if (inFlight.current) return;
    inFlight.current = true;
    setLastChoice(manual);
    setPhase("submitting");
    window.setTimeout(() => {
      actions.decide(memory.id, {
        manual,
        processors: Object.fromEntries(
          processors.map((p) => {
            if (manual === "declined") return [p.id, "declined"];
            // Toggle untouched: keep whatever was decided before.
            if (!aiTouched) return [p.id, prior[p.id] ?? "pending"];
            if (aiOn) return [p.id, "approved"];
            return [p.id, prior[p.id] === "declined" ? "declined" : "pending"];
          }),
        ),
      });
      inFlight.current = false;
      setPhase("committed");
    }, 600);
  }

  if (phase === "committed") {
    const saved = memory.decisions[state.viewerId];
    const ok = lastChoice === "approved";
    return (
      <div
        role="status"
        className="space-y-4 rounded-3xl bg-card p-6 text-center shadow-soft ring-1 ring-border animate-in fade-in-0 slide-in-from-bottom-2"
      >
        <span
          className={cn(
            "mx-auto grid size-14 place-items-center rounded-2xl",
            ok ? "bg-lime text-lime-ink" : "bg-muted text-muted-foreground",
          )}
        >
          {ok ? (
            <CheckCircle2 className="size-7" aria-hidden="true" />
          ) : (
            <X className="size-7" aria-hidden="true" />
          )}
        </span>
        <h2 className="text-xl font-semibold tracking-tight">
          {ok ? "Approved" : "Left out"}
        </h2>
        <p className="text-base text-muted-foreground">
          Now {memoryStatusLabel(memory)}. You can change this anytime.
        </p>
        <div className="flex justify-center">
          <DecisionSummary
            memory={memory}
            decision={saved}
            processors={state.processors}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Button asChild size="lg">
            <Link to="/approvals">Back to inbox</Link>
          </Button>
          <Button variant="ghost" onClick={() => setPhase("idle")}>
            Change my answer
          </Button>
        </div>
      </div>
    );
  }

  const submitting = phase === "submitting";
  return (
    <div className="space-y-4" aria-busy={submitting}>
      <h2 className="text-2xl font-semibold tracking-tighter md:text-3xl">
        Can this go in the zine?
      </h2>

      {processors.length > 0 && (
        <div className="rounded-2xl bg-card p-3 shadow-soft ring-1 ring-border">
          <button
            type="button"
            role="switch"
            aria-checked={aiOn}
            disabled={submitting}
            onClick={() => {
              setAiOn((v) => !v);
              setAiTouched(true);
            }}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Sparkles className="size-5 text-primary" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-base font-medium">
                Let AI help (optional)
              </span>
              <span className="block text-sm text-muted-foreground">
                Off means this is only used as is.
                {!state.aiConfig.enabled && " AI is off right now."}
              </span>
            </span>
            <span
              aria-hidden="true"
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200",
                aiOn ? "bg-primary" : "bg-border",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 size-6 rounded-full bg-white shadow-soft transition-transform duration-200",
                  aiOn && "translate-x-5",
                )}
              />
            </span>
          </button>
        </div>
      )}

      <ActionBar>
        <Button
          size="lg"
          variant="highlight"
          disabled={submitting}
          onClick={() => submit("approved")}
          className="sm:order-2"
        >
          {submitting && lastChoice === "approved" ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" /> Saving
            </>
          ) : (
            <>
              <Check aria-hidden="true" /> Approve
            </>
          )}
        </Button>
        <Button
          size="lg"
          variant="outline"
          disabled={submitting}
          onClick={() => submit("declined")}
          className="sm:order-1"
        >
          {submitting && lastChoice === "declined" ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" /> Saving
            </>
          ) : (
            "Not this one"
          )}
        </Button>
      </ActionBar>

      <div className="flex justify-center">
        {memory.uploaderId === state.viewerId ? (
          <Button asChild variant="ghost">
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
      </div>
    </div>
  );
}

export function ApprovalReview({ memoryId }: { memoryId: string }) {
  const state = usePrototype();
  return state.memories.some((m) => m.id === memoryId) ? (
    <PrototypeApprovalReview memoryId={memoryId} />
  ) : (
    <BackendOnly fallback={<ApprovalNotFound />}>
      <QueryBoundary fallback={<ApprovalNotFound />}>
        <ConvexApprovalReview memoryId={memoryId} />
      </QueryBoundary>
    </BackendOnly>
  );
}

function PrototypeApprovalReview({ memoryId }: { memoryId: string }) {
  const state = usePrototype();
  const memory = state.memories.find((m) => m.id === memoryId);
  const back = (
    <Link
      to="/approvals"
      className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" /> Inbox
    </Link>
  );

  if (!memory || !memory.submitted)
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          icon={<ShieldAlert className="size-5" aria-hidden="true" />}
          title="Not available"
        >
          It was replaced or is not ready yet.
        </EmptyState>
      </div>
    );

  if (!approverIds(memory).includes(state.viewerId))
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          icon={<ShieldAlert className="size-5" aria-hidden="true" />}
          title="Not yours to decide"
        >
          Only people in this memory can review it.
        </EmptyState>
      </div>
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
    <div className="mx-auto max-w-3xl space-y-5 animate-in fade-in-0 slide-in-from-bottom-2">
      {back}
      <Preview memory={memory} />
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tighter text-balance md:text-5xl">
          {memory.title}
        </h1>
        <PeopleRow state={state} memory={memory} />
      </div>

      {hasDecision && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-accent/60 p-3">
          <DecisionSummary
            memory={memory}
            decision={existing}
            processors={state.processors}
          />
          {canWithdraw && <WithdrawDialog memory={memory} />}
        </div>
      )}

      <DecisionForm
        key={`${memory.id}:${memory.version}:${state.viewerId}`}
        state={state}
        memory={memory}
      />

      <DetailsBlock state={state} memory={memory} />
    </div>
  );
}
