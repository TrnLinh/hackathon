import { Link } from "@tanstack/react-router";
import { ArrowRight, Cpu, Inbox, PenLine } from "lucide-react";
import { kindMeta, MemoryThumb } from "@/components/chorus/memory-thumb";
import { PersonAvatar } from "@/components/chorus/people";
import {
  EmptyState,
  PageHeader,
  TrustNote,
} from "@/components/chorus/page-header";
import { MemoryStatusBadge } from "@/components/chorus/status";
import { Button } from "@/components/ui/button";
import { usePrototype } from "@/features/prototype/store";
import { Badge } from "@/components/ui/badge";
import { ConvexInboxSection } from "./convex-inbox";
import {
  approverIds,
  formatWhen,
  inboxFor,
  memoryStatus,
  pendingAiApproverIds,
  personById,
} from "@/features/prototype/selectors";
import type { Memory, PrototypeState } from "@/features/prototype/types";
import { DecisionSummary } from "./decision-summary";
import { WithdrawDialog } from "./withdraw-dialog";

function MemoryMeta({
  state,
  memory,
}: {
  state: PrototypeState;
  memory: Memory;
}) {
  const collection = state.collections.find(
    (c) => c.id === memory.collectionId,
  );
  const uploader = personById(state, memory.uploaderId);
  const KindIcon = kindMeta[memory.kind].icon;
  return (
    <div className="min-w-0 space-y-1">
      <p className="truncate text-xs text-muted-foreground">
        {collection?.title}
      </p>
      <h3 className="truncate font-medium">{memory.title}</h3>
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <KindIcon className="size-3.5" aria-hidden="true" />
          {kindMeta[memory.kind].label}
        </span>
        <span>Version {memory.version}</span>
        <span className="inline-flex items-center gap-1.5">
          <PersonAvatar person={uploader} size="sm" />
          {memory.uploaderId === state.viewerId
            ? "You uploaded"
            : `From ${uploader.name}`}
        </span>
      </p>
    </div>
  );
}

function WaitingCard({
  state,
  memory,
}: {
  state: PrototypeState;
  memory: Memory;
}) {
  const mine = memory.decisions[state.viewerId];
  const processorCount = memory.requestedProcessors.length;
  return (
    <li className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-center">
      <MemoryThumb
        memory={memory}
        className="h-28 w-full shrink-0 rounded-lg sm:h-20 sm:w-28"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <MemoryMeta state={state} memory={memory} />
        <p className="text-sm">
          Asks for{" "}
          <strong className="font-medium">manual use and private review</strong>
          {processorCount > 0 && (
            <>
              . You can also decide on{" "}
              <strong className="font-medium">
                {processorCount} AI processor{processorCount === 1 ? "" : "s"}
              </strong>
              , now or later
            </>
          )}
          .
        </p>
        {mine?.editRequested && (
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <PenLine className="size-3.5" aria-hidden="true" />
            You requested an edit. You can still decide on this version.
          </p>
        )}
      </div>
      <Button asChild className="shrink-0">
        <Link to="/approvals/$memoryId" params={{ memoryId: memory.id }}>
          Review <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </li>
  );
}

function DecidedCard({
  state,
  memory,
}: {
  state: PrototypeState;
  memory: Memory;
}) {
  const mine = memory.decisions[state.viewerId];
  const allWithdrawn =
    mine?.manual === "withdrawn" ||
    (mine?.manual === "declined" &&
      memory.requestedProcessors.every(
        (p) => mine.processors[p] !== "approved",
      ));
  const canWithdraw =
    mine?.manual === "approved" ||
    memory.requestedProcessors.some((p) => mine?.processors[p] === "approved");
  return (
    <li className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-start">
      <MemoryThumb
        memory={memory}
        className="h-28 w-full shrink-0 rounded-lg sm:h-20 sm:w-28"
      />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <MemoryMeta state={state} memory={memory} />
          <MemoryStatusBadge status={memoryStatus(memory)} />
        </div>
        <DecisionSummary
          memory={memory}
          decision={mine}
          processors={state.processors}
        />
        {mine?.decidedAt && (
          <p className="text-xs text-muted-foreground">
            Your decision recorded {formatWhen(mine.decidedAt)}
          </p>
        )}
      </div>
      <div className="flex shrink-0 gap-2 sm:flex-col">
        <Button asChild variant="outline" size="sm">
          <Link to="/approvals/$memoryId" params={{ memoryId: memory.id }}>
            {allWithdrawn ? "Review again" : "Change"}
          </Link>
        </Button>
        {canWithdraw && <WithdrawDialog memory={memory} />}
      </div>
    </li>
  );
}

function AiPendingCard({
  state,
  memory,
}: {
  state: PrototypeState;
  memory: Memory;
}) {
  const mine = memory.decisions[state.viewerId];
  const undecided = memory.requestedProcessors.filter(
    (p) => (mine?.processors[p] ?? "pending") === "pending",
  ).length;
  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
      <MemoryThumb
        memory={memory}
        className="h-20 w-full shrink-0 rounded-lg sm:h-14 sm:w-20"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <MemoryMeta state={state} memory={memory} />
        <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Cpu className="size-3.5" aria-hidden="true" />
          {undecided} AI processor{undecided === 1 ? "" : "s"} not decided ·
          already usable in templates
        </p>
      </div>
      <Button asChild variant="outline" size="sm" className="shrink-0">
        <Link to="/approvals/$memoryId" params={{ memoryId: memory.id }}>
          Decide <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
    </li>
  );
}

export function ApprovalsInbox() {
  const state = usePrototype();
  const viewer = personById(state, state.viewerId);
  const waiting = inboxFor(state, state.viewerId);
  const waitingIds = new Set(waiting.map((m) => m.id));
  const decided = state.memories
    .filter(
      (m) =>
        m.submitted &&
        approverIds(m).includes(state.viewerId) &&
        m.decisions[state.viewerId] &&
        !waitingIds.has(m.id),
    )
    .sort((a, b) =>
      (b.decisions[state.viewerId]?.decidedAt ?? "").localeCompare(
        a.decisions[state.viewerId]?.decidedAt ?? "",
      ),
    );
  // Manual use decided (and still approved), but some AI choices left open.
  const aiOptional = decided.filter(
    (m) =>
      m.decisions[state.viewerId]?.manual === "approved" &&
      pendingAiApproverIds(m).includes(state.viewerId),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Approvals"
        title="Your say in every memory"
        description={`Memories that include you, ${viewer.name.split(" ")[0]}, wait here for your decision. Nothing is used until everyone involved approves.`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [
            "Silence isn’t consent",
            "A memory stays out of the photozine until every person in it approves manual use.",
          ],
          [
            "No reason needed",
            "You can decline without explaining. Others only see “declined”.",
          ],
          [
            "AI is optional",
            "Templates only need manual use. Decide on AI now, later, or never.",
          ],
        ].map(([title, body]) => (
          <div key={title} className="rounded-xl border bg-card/60 p-4">
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {body}
            </p>
          </div>
        ))}
      </div>

      <ConvexInboxSection />

      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          Prototype demo requests <Badge variant="outline">Mock data</Badge>
        </h2>
        <p className="text-sm text-muted-foreground">
          Synthetic requests stored in this browser, for the demo viewer chosen
          at the top of the page.
        </p>
      </div>

      <section aria-labelledby="waiting-heading" className="space-y-3">
        <h2
          id="waiting-heading"
          className="text-lg font-semibold tracking-tight"
        >
          Waiting for you{" "}
          <span className="font-normal text-muted-foreground">
            ({waiting.length})
          </span>
        </h2>
        {waiting.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-5" aria-hidden="true" />}
            title="You’re all caught up"
          >
            When someone adds a memory that includes you, it will appear here
            for review.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {waiting.map((m) => (
              <WaitingCard key={m.id} state={state} memory={m} />
            ))}
          </ul>
        )}
      </section>

      {aiOptional.length > 0 && (
        <section aria-labelledby="ai-optional-heading" className="space-y-3">
          <div>
            <h2
              id="ai-optional-heading"
              className="text-lg font-semibold tracking-tight"
            >
              Optional AI decisions{" "}
              <span className="font-normal text-muted-foreground">
                ({aiOptional.length})
              </span>
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You approved manual use. Until you approve AI, these memories are
              never sent to a model.
              {!state.aiConfig.enabled && " AI is currently turned off anyway."}
            </p>
          </div>
          <ul className="space-y-2">
            {aiOptional.map((m) => (
              <AiPendingCard key={m.id} state={state} memory={m} />
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="decided-heading" className="space-y-3">
        <h2
          id="decided-heading"
          className="text-lg font-semibold tracking-tight"
        >
          Your past decisions{" "}
          <span className="font-normal text-muted-foreground">
            ({decided.length})
          </span>
        </h2>
        {decided.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You haven’t decided on any memories yet.
          </p>
        ) : (
          <ul className="space-y-3">
            {decided.map((m) => (
              <DecidedCard key={m.id} state={state} memory={m} />
            ))}
          </ul>
        )}
      </section>

      <TrustNote>
        Prototype: decisions are stored in this browser only. In the finished
        product, each decision is signed evidence bound to the exact version,
        and protected release is enforced by Tide policies rather than by this
        screen.
      </TrustNote>
    </div>
  );
}
