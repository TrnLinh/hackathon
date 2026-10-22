import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, BookOpenCheck } from "lucide-react";
import { EmptyState, TrustNote } from "@/components/chorus/page-header";
import { PersonAvatar } from "@/components/chorus/people";
import { DecisionBadge } from "@/components/chorus/status";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PlanPages } from "./common";

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
    <Button asChild variant="outline">
      <Link to="/collections/$collectionId/compose" params={{ collectionId }}>
        {children}
      </Link>
    </Button>
  );
}

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
        title="Nothing to review yet"
      >
        The creator has not frozen a candidate for this collection.
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
          <AlertTitle>
            Candidate {candidate.editionId} is no longer valid
          </AlertTitle>
          <AlertDescription>
            {candidate.invalidatedReason ?? "It was invalidated."} Earlier final
            approvals do not carry over. Rebuild the design from the remaining
            approved memories and freeze a new candidate.
          </AlertDescription>
        </Alert>
        <ComposerLink collectionId={collection.id}>
          Return to composer
        </ComposerLink>
      </div>
    );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <div>
          <p className="text-xs text-muted-foreground">
            Exact frozen candidate
          </p>
          <p className="font-mono text-sm font-medium">{candidate.editionId}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          PDF{" "}
          <code className="font-mono">{shortDigest(candidate.pdfDigest)}</code>{" "}
          · frozen {formatWhen(candidate.frozenAt)} by{" "}
          {personById(state, candidate.frozenBy).name}
        </p>
      </div>

      {plan ? (
        <PlanPages plan={plan} state={state} editionId={candidate.editionId} />
      ) : (
        <p className="text-sm text-muted-foreground">
          The candidate’s pages are unavailable.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>
              Final approvals · {progress.approved} of {progress.total}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {Object.entries(candidate.approvals).map(([id, decision]) => (
                <li
                  key={id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex items-center gap-2.5 text-sm">
                    <PersonAvatar person={personById(state, id)} size="sm" />
                    {personById(state, id).name}
                    {id === state.viewerId && (
                      <span className="text-xs text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </span>
                  <DecisionBadge decision={decision} />
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">
              Download members:{" "}
              {candidate.downloadMemberIds
                .map((id) => personById(state, id).name)
                .join(", ")}
            </p>
            {progress.declined > 0 && (
              <div className="mt-4 space-y-3">
                <Alert variant="destructive">
                  <AlertTriangle aria-hidden="true" />
                  <AlertTitle>Issuance is blocked</AlertTitle>
                  <AlertDescription>
                    Someone declined this edition. No reason is required or
                    shown. Remove the affected material and freeze a new
                    candidate.
                  </AlertDescription>
                </Alert>
                <ComposerLink collectionId={collection.id}>
                  Return to composer to remove the dependency
                </ComposerLink>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Your decision</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isApprover ? (
              <p className="text-sm text-muted-foreground">
                Your approval is not required for this edition: none of your
                memories or attributed text appear in it or shaped its style.
              </p>
            ) : viewerDecision !== "pending" ? (
              <p
                className="flex flex-wrap items-center gap-2 text-sm"
                role="status"
              >
                You have decided: <DecisionBadge decision={viewerDecision} />
              </p>
            ) : (
              <>
                <blockquote className="rounded-lg border-l-4 border-primary bg-secondary/50 p-4 font-serif text-base leading-relaxed">
                  {APPROVAL_STATEMENT}
                </blockquote>
                <div className="flex items-start gap-2.5">
                  <Checkbox
                    id="final-ack"
                    checked={acknowledged}
                    onCheckedChange={(v) => setAcknowledged(v === true)}
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="final-ack"
                    className="text-sm leading-snug font-normal"
                  >
                    I reviewed all six pages of {candidate.editionId} and
                    understand that downloaded copies can be forwarded and
                    cannot be recalled.
                  </Label>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={!acknowledged}
                    onClick={() =>
                      actions.finalDecide(candidate.id, "approved")
                    }
                  >
                    Approve this edition
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      actions.finalDecide(candidate.id, "declined")
                    }
                  >
                    Decline
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Declining needs no explanation.
                </p>
              </>
            )}
            <TrustNote>
              Everyone reviewing this preview can see and copy it. Final
              approval certifies the official edition; it is not DRM and cannot
              stop an authorized person from keeping a copy.
            </TrustNote>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
