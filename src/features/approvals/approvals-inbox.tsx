import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, CircleDashed, Inbox, X } from "lucide-react";
import { MemoryThumb } from "@/components/chorus/memory-thumb";
import { PersonAvatar } from "@/components/chorus/people";
import { EmptyState } from "@/components/chorus/page-header";
import { Button } from "@/components/ui/button";
import { usePrototype } from "@/features/prototype/store";
import { Badge } from "@/components/ui/badge";
import { ConvexInboxSection } from "./convex-inbox";
import {
  approverIds,
  inboxFor,
  personById,
} from "@/features/prototype/selectors";
import type { Memory, PrototypeState } from "@/features/prototype/types";
import { WithdrawDialog } from "./withdraw-dialog";

function fromLine(state: PrototypeState, memory: Memory) {
  const uploader = personById(state, memory.uploaderId);
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
      <PersonAvatar person={uploader} size="sm" />
      {memory.uploaderId === state.viewerId
        ? "From you"
        : `From ${uploader.name.split(" ")[0]}`}
    </span>
  );
}

function WaitingCard({
  state,
  memory,
  index,
}: {
  state: PrototypeState;
  memory: Memory;
  index: number;
}) {
  return (
    <li
      style={{ "--i": index } as React.CSSProperties}
      className="rise press relative overflow-hidden rounded-[2rem] bg-card shadow-soft ring-1 ring-border transition md:hover:-translate-y-0.5 md:hover:shadow-lift"
    >
      <MemoryThumb
        memory={memory}
        className="aspect-[4/3] w-full sm:aspect-[16/10]"
      />
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-xl font-semibold tracking-tight">
            {memory.title}
          </h3>
          {fromLine(state, memory)}
        </div>
        <Button asChild variant="highlight" className="relative z-10 shrink-0">
          <Link to="/approvals/$memoryId" params={{ memoryId: memory.id }}>
            Review <ArrowRight aria-hidden="true" />{" "}
          </Link>
        </Button>
      </div>
      <Link
        to="/approvals/$memoryId"
        params={{ memoryId: memory.id }}
        aria-label={`Review ${memory.title}`}
        tabIndex={-1}
        className="absolute inset-0"
      />
    </li>
  );
}

function DecidedRow({
  state,
  memory,
  index,
}: {
  state: PrototypeState;
  memory: Memory;
  index: number;
}) {
  const mine = memory.decisions[state.viewerId];
  const approved = mine?.manual === "approved";
  const gone = mine?.manual === "declined" || mine?.manual === "withdrawn";
  const canWithdraw =
    approved ||
    memory.requestedProcessors.some((p) => mine?.processors[p] === "approved");
  const label = mine?.editRequested
    ? "Change requested"
    : approved
      ? "Approved"
      : mine?.manual === "withdrawn"
        ? "Withdrawn"
        : gone
          ? "Not this one"
          : "Not decided";
  const Icon = approved ? Check : gone ? X : CircleDashed;
  return (
    <li
      style={{ "--i": index } as React.CSSProperties}
      className="rise flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-card p-2 pr-3 shadow-soft ring-1 ring-border sm:flex-nowrap"
    >
      <MemoryThumb
        memory={memory}
        className="size-16 shrink-0 rounded-xl sm:size-20"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{memory.title}</p>
        <p
          className={
            "inline-flex items-center gap-1 text-sm " +
            (approved
              ? "text-[var(--status-available)]"
              : gone
                ? "text-[var(--status-excluded)]"
                : "text-muted-foreground")
          }
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </p>
      </div>
      <div className="flex w-full items-center justify-end sm:w-auto sm:shrink-0">
        <Button asChild variant="ghost">
          <Link to="/approvals/$memoryId" params={{ memoryId: memory.id }}>
            Change
          </Link>
        </Button>
        {canWithdraw && <WithdrawDialog memory={memory} />}
      </div>
    </li>
  );
}

export function ApprovalsInbox() {
  const state = usePrototype();
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

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-semibold tracking-tighter md:text-5xl">
        Inbox
      </h1>

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
          <span className="tabular font-normal text-muted-foreground">
            {waiting.length}
          </span>
        </h2>
        {waiting.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-6" aria-hidden="true" />}
            title="You are all caught up"
          />
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {waiting.map((m, i) => (
              <WaitingCard key={m.id} state={state} memory={m} index={i} />
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section aria-labelledby="decided-heading" className="space-y-3">
          <h2
            id="decided-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Decided
          </h2>
          <ul className="grid gap-2 md:grid-cols-2">
            {decided.map((m, i) => (
              <DecidedRow key={m.id} state={state} memory={m} index={i} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
