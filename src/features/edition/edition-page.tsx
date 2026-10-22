import { useState } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { usePrototype } from "@/features/prototype/store";
import { candidateProgress } from "@/features/prototype/selectors";
import type { Candidate } from "@/features/prototype/types";
import { DownloadStep, PriorCandidates } from "./download-step";
import { FreezeStep } from "./freeze-step";
import { IssueStep } from "./issue-step";
import { ReviewStep } from "./review-step";

// CH-10 freeze → CH-11 final review → CH-12 receipt → CH-13 download.

const steps = [
  { id: "freeze", label: "Freeze", hint: "Exact PDF candidate" },
  { id: "review", label: "Final review", hint: "Everyone involved approves" },
  { id: "issue", label: "Issue", hint: "Signed consent receipt" },
  { id: "download", label: "Download", hint: "Keep and share the file" },
] as const;

type StepId = (typeof steps)[number]["id"];

function currentStep(candidate?: Candidate): StepId {
  if (!candidate || candidate.status === "invalidated") return "freeze";
  if (candidate.status === "issued") return "download";
  const p = candidateProgress(candidate);
  return p.total > 0 && p.approved === p.total ? "issue" : "review";
}

export function EditionPage({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  const collection = state.collections.find((c) => c.id === collectionId);
  const candidate = state.candidates
    .filter((c) => c.collectionId === collectionId)
    .sort((a, b) => b.frozenAt.localeCompare(a.frozenAt))[0];
  const progressStep = currentStep(candidate);
  const [chosen, setChosen] = useState<StepId | null>(null);
  const step = chosen ?? progressStep;
  if (!collection) return null;
  const progressIndex = steps.findIndex((s) => s.id === progressStep);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl tracking-tight">Edition</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Freeze an exact PDF, collect every required approval, issue a receipt,
          and download the file. Any change after freezing needs a new candidate
          and fresh approvals.
        </p>
      </div>

      <nav aria-label="Edition steps">
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {steps.map((s, i) => {
            const done = i < progressIndex;
            const active = s.id === step;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setChosen(s.id)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    active
                      ? "border-primary bg-secondary"
                      : "bg-card hover:bg-secondary/50",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                      done &&
                        "border-primary bg-primary text-primary-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {done ? <Check className="size-3" /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{s.label}</span>
                    <span className="block text-xs text-muted-foreground">
                      {done
                        ? "Done"
                        : i === progressIndex
                          ? "Current step"
                          : s.hint}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {candidate?.status === "invalidated" && step === "freeze" && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>
            The last candidate, {candidate.editionId}, was invalidated
          </AlertTitle>
          <AlertDescription>
            {candidate.invalidatedReason ?? "No reason recorded."} Its approvals
            no longer count. Freeze a new candidate from a valid design.
          </AlertDescription>
        </Alert>
      )}

      {step === "freeze" && (
        <FreezeStep
          state={state}
          collection={collection}
          candidate={candidate}
          onFrozen={() => setChosen("review")}
        />
      )}
      {step === "review" && (
        <ReviewStep
          state={state}
          collection={collection}
          candidate={candidate}
        />
      )}
      {step === "issue" && (
        <IssueStep
          state={state}
          collection={collection}
          candidate={candidate}
        />
      )}
      {step === "download" && (
        <DownloadStep
          state={state}
          collection={collection}
          candidate={candidate}
        />
      )}
      {step !== "download" && (
        <PriorCandidates
          state={state}
          collection={collection}
          current={candidate}
        />
      )}
    </div>
  );
}
