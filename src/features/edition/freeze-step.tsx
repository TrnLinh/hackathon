import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, FileLock2, Loader2, PenTool } from "lucide-react";
import { EmptyState, TrustNote } from "@/components/chorus/page-header";
import { PersonAvatar } from "@/components/chorus/people";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  SectionTitle,
} from "./common";

const RENDER_MS = 1500;
const TARGET_S = 30;

export function latestValidPlan(state: PrototypeState, collectionId: string) {
  return state.plans
    .filter((p) => p.collectionId === collectionId && !p.invalidatedReason)
    .sort((a, b) => b.revision - a.revision)[0];
}

/** Why each final approver is required (CH-11 influence closure). */
function approverReasons(state: PrototypeState, plan: DesignPlan) {
  const reasons = new Map<PersonId, string[]>();
  const add = (id: PersonId, reason: string) =>
    reasons.set(id, [...(reasons.get(id) ?? []), reason]);
  const visible = planVisibleIds(plan);
  for (const id of [...visible, ...plan.styleOnlyIds]) {
    const m = state.memories.find((x) => x.id === id);
    if (!m) continue;
    const kind = visible.includes(id) ? "Appears in" : "Style-only source";
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
        title="No design to freeze yet"
        action={
          <Button asChild>
            <Link
              to="/collections/$collectionId/compose"
              params={{ collectionId: collection.id }}
            >
              Open the composer
            </Link>
          </Button>
        }
      >
        Start from a template or, when AI is on, create a design with AI.
        Invalidated design revisions cannot be frozen.
      </EmptyState>
    );

  const reasons = approverReasons(state, plan);
  const approvers = finalApproverIds(state, plan);
  const stale = staleSources(state, plan);
  // The same CH-20 validator as the composer: invalid or unfinished plans,
  // such as an empty template draft, cannot become a candidate.
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
    <div className="space-y-8">
      <section aria-labelledby="freeze-preview" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <SectionTitle>
            <span id="freeze-preview">
              Design revision {plan.revision} · {plan.tokens.name}
            </span>
          </SectionTitle>
          <p className="text-xs text-muted-foreground">
            {originSummary(plan)} · 6 portrait A5 pages
          </p>
        </div>
        <PlanPages plan={plan} state={state} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Who must approve this edition</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {approvers.map((id) => {
                const person = personById(state, id);
                return (
                  <li key={id} className="flex gap-3">
                    <PersonAvatar person={person} />
                    <div className="min-w-0 text-sm">
                      <p className="font-medium">{person.name}</p>
                      <ul className="mt-0.5 space-y-0.5 text-xs text-muted-foreground">
                        {(reasons.get(id) ?? []).map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  </li>
                );
              })}
            </ul>
            <TrustNote className="mt-5">
              Sources that only shaped the palette, layout, or headings still
              need their contributors’ approval. The creator cannot approve on
              anyone’s behalf.
            </TrustNote>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Manifest preview</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="divide-y text-sm">
              <ManifestRow label="Plan">
                <code className="font-mono text-xs">
                  {plan.id} · revision {plan.revision}
                </code>
              </ManifestRow>
              <ProvenanceRows plan={plan} />
              <ManifestRow label="Schema">{plan.schemaVersion}</ManifestRow>
              <ManifestRow label="Renderer">
                chorus-zine-renderer 0.1 (prototype)
              </ManifestRow>
              <ManifestRow label="Fonts">Local system stacks</ManifestRow>
              <ManifestRow label="Visible sources">
                <SourceList state={state} ids={visible} />
              </ManifestRow>
              <ManifestRow label="Style-only sources">
                {plan.styleOnlyIds.length ? (
                  <SourceList state={state} ids={plan.styleOnlyIds} />
                ) : (
                  "None"
                )}
              </ManifestRow>
              <ManifestRow label="Review audience">
                Required approvers only
              </ManifestRow>
              <ManifestRow label="Download members">
                {collection.memberIds
                  .map((id) => personById(state, id).name)
                  .join(", ")}
              </ManifestRow>
            </dl>
          </CardContent>
        </Card>
      </div>

      <section
        aria-labelledby="freeze-action"
        className="space-y-4 rounded-xl border bg-card p-5"
      >
        <h2
          id="freeze-action"
          className="flex items-center gap-2 font-semibold"
        >
          <FileLock2 className="size-4" aria-hidden="true" /> Freeze an exact
          candidate
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Freezing renders the plan once into exact PDF bytes and commits a
          manifest. The edition identifier is printed inside the PDF before
          freezing; approval signatures live in a separate receipt. The PDF is
          never re-rendered after approval, and any change creates a new
          candidate that needs fresh approvals. Freezing never needs AI; it
          works the same whether AI is on or off.
        </p>
        <p className="text-xs text-muted-foreground">{aiToggleNote}</p>

        {stale.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>This design cannot be frozen</AlertTitle>
            <AlertDescription>
              {stale.join(", ")} {stale.length === 1 ? "is" : "are"} no longer
              approved. Return to the composer and rebuild the design without{" "}
              {stale.length === 1 ? "it" : "them"}.
            </AlertDescription>
          </Alert>
        )}

        {stale.length === 0 && failedChecks.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Finish the design before freezing</AlertTitle>
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
                className="mt-2 inline-block underline underline-offset-4"
              >
                Open the composer
              </Link>
            </AlertDescription>
          </Alert>
        )}

        {failed && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Rendering failed</AlertTitle>
            <AlertDescription>
              No candidate was created, so nothing can be approved by mistake.
              Your design revision is unchanged. Try again.
            </AlertDescription>
          </Alert>
        )}

        {frozenFromThis && !rendering && (
          <FrozenSummary candidate={frozenFromThis} />
        )}

        {rendering && (
          <div className="space-y-2" role="status" aria-live="polite">
            <p className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Rendering six A5 pages and embedding images and fonts…
            </p>
            <Progress
              value={((elapsed ?? 0) / RENDER_MS) * 100}
              aria-label="Render progress"
            />
            <p className="text-xs text-muted-foreground">
              {((elapsed ?? 0) / 1000).toFixed(1)} s elapsed · target under{" "}
              {TARGET_S} s on the demo device (simulated)
            </p>
          </div>
        )}

        {isCreator ? (
          <div className="flex flex-wrap items-center gap-4">
            <Button
              onClick={startRender}
              disabled={
                rendering || stale.length > 0 || failedChecks.length > 0
              }
            >
              {frozenFromThis
                ? "Freeze a replacement candidate"
                : "Freeze candidate"}
            </Button>
            <div className="flex items-center gap-2">
              <Checkbox
                id="simulate-failure"
                checked={simulateFailure}
                onCheckedChange={(v) => setSimulateFailure(v === true)}
                disabled={rendering}
              />
              <Label
                htmlFor="simulate-failure"
                className="text-xs font-normal text-muted-foreground"
              >
                Simulate a render failure (prototype)
              </Label>
            </div>
            {frozenFromThis && (
              <p className="w-full text-xs text-muted-foreground">
                A replacement invalidates {frozenFromThis.editionId} and its
                approvals.
              </p>
            )}
          </div>
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            Waiting for {personById(state, collection.creatorId).name}, the
            collection creator, to freeze a candidate.
          </p>
        )}
      </section>
    </div>
  );
}

function FrozenSummary({ candidate }: { candidate: Candidate }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="text-sm font-medium">
        Frozen as <span className="font-mono">{candidate.editionId}</span>
      </p>
      <dl className="mt-2 divide-y">
        <DigestRow label="PDF digest (SHA-256)" digest={candidate.pdfDigest} />
        <DigestRow
          label="Manifest digest (SHA-256)"
          digest={candidate.manifestDigest}
        />
        <div className="flex justify-between py-2 text-xs">
          <dt className="text-muted-foreground">File</dt>
          <dd>{formatBytes(candidate.sizeBytes)} · A5 portrait × 6 pages</dd>
        </div>
      </dl>
      <p className="mt-2 text-xs text-muted-foreground">
        Digests are synthetic in this prototype.
      </p>
    </div>
  );
}

function ManifestRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[140px_minmax(0,1fr)]">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
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
            <span className="text-xs text-muted-foreground">
              {m ? `${m.kind} · v${m.version}` : id}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
