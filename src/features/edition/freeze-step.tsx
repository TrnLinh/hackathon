import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2, PenTool } from "lucide-react";
import { EmptyState } from "@/components/chorus/page-header";
import { ActionBar, Disclosure } from "@/components/chorus/primitives";
import { PersonAvatar } from "@/components/chorus/people";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { validatePlan } from "@/features/composer/plan-utils";
import { actions } from "@/features/prototype/store";
import {
  approverIds,
  finalApproverIds,
  formatBytes,
  manualEligible,
  personById,
  planVisibleIds,
} from "@/features/prototype/selectors";
import type {
  Candidate,
  Collection,
  DesignPlan,
  PersonId,
  PrototypeState,
} from "@/features/prototype/types";
import {
  aiToggleNote,
  DigestRow,
  originSummary,
  PlanPages,
  ProvenanceRows,
} from "./common";

const RENDER_MS = 1500;
const TARGET_S = 30;

export function latestValidPlan(state: PrototypeState, collectionId: string) {
  return state.plans
    .filter((p) => p.collectionId === collectionId && !p.invalidatedReason)
    .sort((a, b) => b.revision - a.revision)[0];
}

/** Why each final approver is required (influence closure). */
function approverReasons(state: PrototypeState, plan: DesignPlan) {
  const reasons = new Map<PersonId, string[]>();
  const add = (id: PersonId, reason: string) =>
    reasons.set(id, [...(reasons.get(id) ?? []), reason]);
  const visible = planVisibleIds(plan);
  for (const id of [...visible, ...plan.styleOnlyIds]) {
    const m = state.memories.find((x) => x.id === id);
    if (!m) continue;
    const kind = visible.includes(id) ? "Appears in" : "Shaped the style of";
    for (const p of approverIds(m))
      add(p, `${kind}: “${m.title}” v${m.version}`);
  }
  for (const page of plan.pages)
    for (const block of page.blocks)
      if (block.edited && block.attributionId)
        add(
          block.attributionId,
          `Author of edited text: “${(block.text ?? "").slice(0, 40)}”`,
        );
  return reasons;
}

/** Sources that are no longer approved make the plan unfreezable. */
function staleSources(state: PrototypeState, plan: DesignPlan) {
  return [...planVisibleIds(plan), ...plan.styleOnlyIds]
    .map((id) => state.memories.find((m) => m.id === id))
    .filter((m) => !m || !manualEligible(m))
    .map((m) => m?.title ?? "A removed memory");
}

export function FreezeStep({
  state,
  collection,
  candidate,
  onFrozen,
}: {
  state: PrototypeState;
  collection: Collection;
  candidate?: Candidate;
  onFrozen: () => void;
}) {
  const plan = latestValidPlan(state, collection.id);
  const isCreator = collection.creatorId === state.viewerId;
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [failed, setFailed] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
    },
    [],
  );

  if (!plan)
    return (
      <EmptyState
        icon={<PenTool className="size-5" aria-hidden="true" />}
        title="No design yet"
        action={
          <Button asChild size="lg">
            <Link
              to="/collections/$collectionId/compose"
              params={{ collectionId: collection.id }}
            >
              Open the designer
            </Link>
          </Button>
        }
      >
        Pick a layout first, then come back to lock it.
      </EmptyState>
    );

  const reasons = approverReasons(state, plan);
  const approvers = finalApproverIds(state, plan);
  const stale = staleSources(state, plan);
  const failedChecks = validatePlan(
    plan,
    state.memories.filter((m) => m.collectionId === plan.collectionId),
    collection.memberIds,
  ).filter((row) => !row.ok);
  const visible = planVisibleIds(plan);
  const frozenFromThis =
    candidate &&
    candidate.planId === plan.id &&
    candidate.status !== "invalidated"
      ? candidate
      : undefined;
  const rendering = elapsed !== null;

  function startRender() {
    setFailed(false);
    let ms = 0;
    setElapsed(0);
    timer.current = window.setInterval(() => {
      ms += 100;
      if (ms >= RENDER_MS) {
        window.clearInterval(timer.current!);
        timer.current = null;
        setElapsed(null);
        if (simulateFailure) {
          setFailed(true);
          return;
        }
        actions.freezeCandidate(plan!.id);
        onFrozen();
      } else setElapsed(ms);
    }, 100);
  }

  return (
    <div className="space-y-5">
      <section
        aria-labelledby="freeze-preview"
        className="space-y-4 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border sm:p-6"
      >
        <div>
          <h2
            id="freeze-preview"
            className="text-3xl font-semibold tracking-tighter"
          >
            Lock this version
          </h2>
          <p className="mt-1 text-base text-muted-foreground">
            Six pages, ready for everyone to approve.
          </p>
        </div>
        <PlanPages plan={plan} state={state} />

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Needs approval from
          </span>
          <ul className="flex flex-wrap gap-2">
            {approvers.map((id) => {
              const person = personById(state, id);
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-full bg-muted py-1 pr-3 pl-1 text-sm"
                >
                  <PersonAvatar person={person} size="sm" />
                  {person.name.split(" ")[0]}
                </li>
              );
            })}
          </ul>
        </div>

        {stale.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>This design cannot be locked</AlertTitle>
            <AlertDescription>
              {stale.join(", ")} {stale.length === 1 ? "is" : "are"} no longer
              approved. Rebuild the design without{" "}
              {stale.length === 1 ? "it" : "them"}.
            </AlertDescription>
          </Alert>
        )}

        {stale.length === 0 && failedChecks.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Finish the design first</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {failedChecks.map((row) => (
                  <li key={row.id}>
                    {row.label}: {row.detail}
                  </li>
                ))}
              </ul>
              <Link
                to="/collections/$collectionId/compose"
                params={{ collectionId: plan.collectionId }}
                className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4"
              >
                Open the designer
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {failed && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>That did not work</AlertTitle>
            <AlertDescription>
              Nothing was locked and your design is unchanged. Try again.
            </AlertDescription>
          </Alert>
        )}

        {rendering && (
          <div className="space-y-2" role="status" aria-live="polite">
            <p className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Building the PDF
            </p>
            <Progress
              value={((elapsed ?? 0) / RENDER_MS) * 100}
              aria-label="Progress"
            />
          </div>
        )}

        {!isCreator && (
          <p role="status" className="text-base text-muted-foreground">
            Waiting for {personById(state, collection.creatorId).name} to lock
            this version.
          </p>
        )}

        {frozenFromThis && isCreator && !rendering && (
          <p className="text-sm text-muted-foreground">
            Locking again replaces {frozenFromThis.editionId} and clears its
            approvals.
          </p>
        )}
      </section>

      {isCreator && (
        <ActionBar>
          <Button
            variant="highlight"
            size="lg"
            className="w-full sm:w-auto"
            onClick={startRender}
            disabled={rendering || stale.length > 0 || failedChecks.length > 0}
          >
            {frozenFromThis ? "Lock a new version" : "Lock this version"}
          </Button>
        </ActionBar>
      )}

      <Disclosure summary="Details">
        <dl className="divide-y">
          <Item label="Design">
            Version {plan.revision}, {plan.tokens.name}. {originSummary(plan)}
          </Item>
          <ProvenanceRows plan={plan} />
          <Item label="Format">
            A5 portrait, 6 pages ({plan.schemaVersion})
          </Item>
          <Item label="Photos and notes in it">
            <SourceList state={state} ids={visible} />
          </Item>
          <Item label="Only shaped the style">
            {plan.styleOnlyIds.length ? (
              <SourceList state={state} ids={plan.styleOnlyIds} />
            ) : (
              "None"
            )}
          </Item>
          <Item label="Can download">
            {collection.memberIds
              .map((id) => personById(state, id).name)
              .join(", ")}
          </Item>
          <Item label="Why each person approves">
            <ul className="space-y-2">
              {approvers.map((id) => (
                <li key={id}>
                  <span className="font-medium text-foreground">
                    {personById(state, id).name}
                  </span>
                  <ul className="text-sm">
                    {(reasons.get(id) ?? []).map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </Item>
        </dl>
        {frozenFromThis && <FrozenSummary candidate={frozenFromThis} />}
        <p>{aiToggleNote}</p>
        {isCreator && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="simulate-failure"
              checked={simulateFailure}
              onCheckedChange={(v) => setSimulateFailure(v === true)}
              disabled={rendering}
            />
            <Label htmlFor="simulate-failure" className="font-normal">
              Simulate a failure (prototype)
            </Label>
          </div>
        )}
        <p>
          Target under {TARGET_S} seconds. Approvals are never done for others.
        </p>
      </Disclosure>
    </div>
  );
}

function FrozenSummary({ candidate }: { candidate: Candidate }) {
  return (
    <div>
      <p className="font-medium text-foreground">
        Locked as <span className="font-mono">{candidate.editionId}</span>
      </p>
      <dl className="divide-y">
        <DigestRow label="PDF fingerprint" digest={candidate.pdfDigest} />
        <DigestRow
          label="Manifest fingerprint"
          digest={candidate.manifestDigest}
        />
        <div className="flex justify-between py-2 text-sm">
          <dt>File</dt>
          <dd>{formatBytes(candidate.sizeBytes)}</dd>
        </div>
      </dl>
    </div>
  );
}

function Item({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[140px_minmax(0,1fr)]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function SourceList({ state, ids }: { state: PrototypeState; ids: string[] }) {
  return (
    <ul className="space-y-0.5">
      {ids.map((id) => {
        const m = state.memories.find((x) => x.id === id);
        return (
          <li key={id}>
            {m ? m.title : "Missing source"}{" "}
            <span className="text-muted-foreground">
              {m ? `${m.kind} v${m.version}` : id}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
