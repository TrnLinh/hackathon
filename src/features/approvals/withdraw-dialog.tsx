import { useState, type ReactNode } from "react";
import { Undo2 } from "lucide-react";
import { TrustNote } from "@/components/chorus/page-header";
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
import { actions, usePrototype } from "@/features/prototype/store";
import { planInfluenceIds } from "@/features/prototype/selectors";
import type { Memory } from "@/features/prototype/types";

type Scope = "ai" | "all";

/** CH-08: withdrawal with an exact statement of what it can and cannot do. */
export function WithdrawDialog({
  memory,
  trigger,
  onWithdrawn,
}: {
  memory: Memory;
  trigger?: ReactNode;
  onWithdrawn?: (scope: Scope) => void;
}) {
  const state = usePrototype();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("ai");
  const [pending, setPending] = useState(false);

  const plans = state.plans.filter(
    (p) => !p.invalidatedReason && planInfluenceIds(p).includes(memory.id),
  );
  const candidates = state.candidates.filter(
    (c) =>
      c.status !== "invalidated" &&
      (c.visibleIds.includes(memory.id) || c.styleOnlyIds.includes(memory.id)),
  );
  const jobs = state.jobs.filter(
    (j) =>
      (j.status === "queued" || j.status === "running") &&
      j.memoryIds.includes(memory.id),
  );

  function confirm() {
    setPending(true);
    window.setTimeout(() => {
      actions.withdraw(memory.id, scope);
      setPending(false);
      setOpen(false);
      onWithdrawn?.(scope);
    }, 600);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <Undo2 aria-hidden="true" /> Withdraw
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Withdraw permission for “{memory.title}”</DialogTitle>
          <DialogDescription>
            Version {memory.version}. Choose what to stop. You don’t need to
            give a reason.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={scope}
          onValueChange={(v) => setScope(v as Scope)}
          aria-label="Withdrawal scope"
          className="gap-3"
        >
          <Label
            htmlFor="withdraw-ai"
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-[[data-state=checked]]:border-primary"
          >
            <RadioGroupItem id="withdraw-ai" value="ai" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">
                AI processing only
              </span>
              <span className="block text-xs text-muted-foreground">
                The named editor can still use it manually. It stops being sent
                to any processor and stops influencing AI designs.
              </span>
            </span>
          </Label>
          <Label
            htmlFor="withdraw-all"
            className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal has-[[data-state=checked]]:border-primary"
          >
            <RadioGroupItem id="withdraw-all" value="all" className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">All future use</span>
              <span className="block text-xs text-muted-foreground">
                The memory is excluded from composition, processing, and every
                new edition until you approve again.
              </span>
            </span>
          </Label>
        </RadioGroup>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="mb-1.5 font-medium">What this does</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Blocks future protected releases under this permission</li>
              <li>Cancels queued processing and discards late results</li>
              {scope === "all" && (
                <li>Blocks new editions and new app downloads that use it</li>
              )}
              <li>Invalidates dependent designs and candidates</li>
            </ul>
          </div>
          <div className="rounded-lg border p-3">
            <p className="mb-1.5 font-medium">What it can’t do</p>
            <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
              <li>Recall previews people have already seen</li>
              <li>Recall PDFs that have already been downloaded</li>
              <li>Undo content already sent to a processor</li>
            </ul>
          </div>
        </div>

        <div className="text-sm">
          <p className="mb-1.5 font-medium">Affected work</p>
          {plans.length + candidates.length + jobs.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nothing currently depends on this memory.
            </p>
          ) : (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {plans.map((p) => (
                <li key={p.id}>
                  Design revision {p.revision} ({p.tokens.name}){" "}
                  {p.styleOnlyIds.includes(memory.id)
                    ? "uses it for style only"
                    : "shows it on a page"}{" "}
                  and will be invalidated
                </li>
              ))}
              {candidates.map((c) => (
                <li key={c.id}>
                  {c.status === "issued"
                    ? `Issued edition ${c.editionId}: new app downloads will be blocked${scope === "ai" ? " only if you withdraw all use" : ""}`
                    : `Candidate ${c.editionId} will be invalidated and needs a new design and fresh final approvals`}
                </li>
              ))}
              {jobs.map((j) => (
                <li key={j.id}>Running job “{j.label}” will be cancelled</li>
              ))}
            </ul>
          )}
        </div>

        <TrustNote>
          Prototype: this updates browser-local data. The real flow commits a
          Tide-ordered permission revision; whichever commits first, a release
          or your withdrawal, decides the outcome.
        </TrustNote>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Keep permission
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? "Withdrawing…" : "Withdraw permission"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
