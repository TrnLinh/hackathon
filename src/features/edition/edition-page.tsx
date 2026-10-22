import { AlertTriangle, Check } from "lucide-react";
import { StepProgress } from "@/components/chorus/primitives";
import type { Step } from "@/components/chorus/primitives";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { usePrototype } from "@/features/prototype/store";
import { candidateProgress } from "@/features/prototype/selectors";
import type { Candidate } from "@/features/prototype/types";
import { DownloadStep, PriorCandidates } from "./download-step";
import { FreezeStep } from "./freeze-step";
import { IssueStep } from "./issue-step";
import { ReviewStep } from "./review-step";

// Lock -> Approve -> Official -> Download.

const steps = [
  { id: "freeze", label: "Lock", done: "Version locked" },
  { id: "review", label: "Approve", done: "Everyone approved" },
  { id: "issue", label: "Official", done: "Made official" },
  { id: "download", label: "Download", done: "Ready to download" },
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
  const step = currentStep(candidate);
  if (!collection) return null;
  const progressIndex = steps.findIndex((s) => s.id === step);

  const progress: Step[] = steps.map((s, i) => ({
    key: s.id,
    label: s.label,
    state:
      i < progressIndex ? "done" : i === progressIndex ? "current" : "todo",
  }));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 animate-in fade-in-0 slide-in-from-bottom-2">
      <h1 className="text-4xl leading-none font-semibold tracking-tighter sm:text-5xl">
        Share
      </h1>

      <StepProgress steps={progress} />

      {progressIndex > 0 && (
        <ul className="space-y-1.5">
          {steps.slice(0, progressIndex).map((s) => (
            <li
              key={s.id}
              className="flex min-h-11 items-center gap-2.5 rounded-full bg-accent px-3 text-sm font-medium"
            >
              <Check className="size-4 text-primary" aria-hidden="true" />
              {s.done}
            </li>
          ))}
        </ul>
      )}

      {candidate?.status === "invalidated" && step === "freeze" && (
        <Alert variant="destructive">
          <AlertTriangle aria-hidden="true" />
          <AlertTitle>
            The last draft, {candidate.editionId}, is no longer valid
          </AlertTitle>
          <AlertDescription>
            {candidate.invalidatedReason ?? "No reason recorded."} Its approvals
            no longer count. Lock a new version.
          </AlertDescription>
        </Alert>
      )}

      {step === "freeze" && (
        <FreezeStep
          state={state}
          collection={collection}
          candidate={candidate}
          onFrozen={() => {}}
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
