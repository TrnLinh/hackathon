import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, BookOpenCheck, Check, Clock, X } from "lucide-react";
import { EmptyState, TrustNote } from "@/components/chorus/page-header";
import { ActionBar, Disclosure } from "@/components/chorus/primitives";
import { PersonAvatar } from "@/components/chorus/people";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { actions } from "@/features/prototype/store";
import {
  candidateProgress,
  formatWhen,
  personById,
  shortDigest,
} from "@/features/prototype/selectors";
import type {
  Candidate,
  Collection,
  PrototypeState,
} from "@/features/prototype/types";
import { aiToggleNote, PlanPages, ProvenanceRows } from "./common";

export const APPROVAL_STATEMENT =
  "I approve this edition as a file that the named collection members can download, keep, print, and share outside Chorus.";

function ComposerLink({
  collectionId,
  children,
}: {
  collectionId: string;
  children: React.ReactNode;
}) {
  return (
    <Button asChild variant="outline" size="lg">
      <Link to="/collections/$collectionId/compose" params={{ collectionId }}>
        {children}
      </Link>
    </Button>
  );
}

const decisionMeta = {
  approved: { icon: Check, text: "Approved", tone: "text-primary" },
  pending: { icon: Clock, text: "Waiting", tone: "text-muted-foreground" },
  declined: { icon: X, text: "Declined", tone: "text-destructive" },
} as const;

export function ReviewStep({
  state,
  collection,
  candidate,
}: {
  state: PrototypeState;
  collection: Collection;
  candidate?: Candidate;
}) {
  const [acknowledged, setAcknowledged] = useState(false);

  if (!candidate)
    return (
      <EmptyState
        icon={<BookOpenCheck className="size-5" aria-hidden="true" />}
        title="Nothing to approve yet"
      >
        The creator has not locked a version.
      </EmptyState>
    );

  const plan = state.plans.find((p) => p.id === candidate.planId);
  const progress = candidateProgress(candidate);
  const viewerDecision = candidate.approvals[state.viewerId];
  const isApprover = viewerDecision !== undefined;

  if (candidate.status === "invalidated")
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>{candidate.editionId} is no longer valid</AlertTitle>
          <AlertDescription>
            {candidate.invalidatedReason ?? "It was replaced."} Earlier
            approvals do not carry over. Rebuild the design and lock a new
            version.
          </AlertDescription>
        </Alert>
        <ComposerLink collectionId={collection.id}>
          Back to the designer
        </ComposerLink>
      </div>
    );

  const needsDecision = isApprover && viewerDecision === "pending";

  return (
    <div className="space-y-5">
      <section
        aria-labelledby="approve-title"
        className="space-y-4 rounded-3xl bg-card p-4 shadow-soft ring-1 ring-border sm:p-6"
      >
        <div>
          <h2
            id="approve-title"
            className="text-3xl font-semibold tracking-tighter"
          >
            {needsDecision ? "Approve this edition" : "Waiting for approvals"}
          </h2>
          <p className="mt-1 text-base text-muted-foreground">
            Everyone in it must say yes before it is official.
          </p>
        </div>

        {plan ? (
          <PlanPages
            plan={plan}
            state={state}
            editionId={candidate.editionId}
          />
        ) : (
          <p className="text-base text-muted-foreground">
            The pages are unavailable.
          </p>
        )}

        <div className="space-y-3">
          <p className="tabular text-base font-medium" role="status">
            {progress.approved} of {progress.total} approved
          </p>
          <ul className="flex flex-wrap gap-2">
            {Object.entries(candidate.approvals).map(([id, decision]) => {
              const meta = decisionMeta[decision];
              const Icon = meta.icon;
              const person = personById(state, id);
              return (
                <li
                  key={id}
                  className="flex min-h-11 items-center gap-2 rounded-full bg-muted py-1 pr-3 pl-1.5"
                >
                  <PersonAvatar person={person} size="sm" />
                  <span className="text-sm">
                    {id === state.viewerId ? "You" : person.name.split(" ")[0]}
                  </span>
                  <span
                    className={`flex items-center gap-1 text-sm font-medium ${meta.tone}`}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                    {meta.text}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {progress.declined > 0 && (
          <div className="space-y-3">
            <Alert variant="destructive">
              <AlertTriangle aria-hidden="true" />
              <AlertTitle>Someone said no</AlertTitle>
              <AlertDescription>
                No reason is needed. Remove the affected material and lock a new
                version.
              </AlertDescription>
            </Alert>
            <ComposerLink collectionId={collection.id}>
              Back to the designer
            </ComposerLink>
          </div>
        )}

        {!isApprover && (
          <p className="text-base text-muted-foreground">
            Your approval is not needed. Nothing of yours is in this edition.
          </p>
        )}
        {isApprover && viewerDecision !== "pending" && (
          <p className="text-base text-muted-foreground" role="status">
            You {viewerDecision === "approved" ? "approved" : "said no to"} this
            edition.
          </p>
        )}

        {needsDecision && (
          <Label
            htmlFor="final-ack"
            className="press flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl bg-muted/60 px-4 py-2 text-base leading-snug font-normal"
          >
            <Checkbox
              id="final-ack"
              checked={acknowledged}
              onCheckedChange={(v) => setAcknowledged(v === true)}
              className="size-6 shrink-0"
            />
            I checked all six pages. Downloaded copies cannot be recalled.
          </Label>
        )}
      </section>

      {needsDecision && (
        <ActionBar>
          <Button
            variant="highlight"
            size="lg"
            className="w-full sm:w-auto"
            disabled={!acknowledged}
            onClick={() => actions.finalDecide(candidate.id, "approved")}
          >
            Approve this edition
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => actions.finalDecide(candidate.id, "declined")}
          >
            Not this one
          </Button>
        </ActionBar>
      )}

      <Disclosure summary="Details">
        <p className="font-medium text-foreground">
          <span className="font-mono">{candidate.editionId}</span>, locked{" "}
          {formatWhen(candidate.frozenAt)} by{" "}
          {personById(state, candidate.frozenBy).name}
        </p>
        <p>
          PDF fingerprint{" "}
          <code className="font-mono">{shortDigest(candidate.pdfDigest)}</code>
        </p>
        <p>
          Can download:{" "}
          {candidate.downloadMemberIds
            .map((id) => personById(state, id).name)
            .join(", ")}
        </p>
        {plan && (
          <dl className="divide-y">
            <ProvenanceRows plan={plan} />
          </dl>
        )}
        <p>{aiToggleNote}</p>
        <p className="rounded-xl bg-card p-3 text-foreground">
          {APPROVAL_STATEMENT}
        </p>
      </Disclosure>
      <TrustNote>
        Anyone who sees this preview can copy it. Approving does not stop
        copies.
      </TrustNote>
    </div>
  );
}
