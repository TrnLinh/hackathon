import { useState, type ReactNode } from "react";
import { Undo2 } from "lucide-react";
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
import { Disclosure } from "@/components/chorus/primitives";
import { actions, usePrototype } from "@/features/prototype/store";
import { planInfluenceIds } from "@/features/prototype/selectors";
import type { Memory } from "@/features/prototype/types";

type Scope = "ai" | "all";

/** Withdraw permission: pick what to stop, then confirm. */
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
  const [scope, setScope] = useState<Scope>("all");
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

  const option =
    "flex min-h-14 cursor-pointer items-center gap-3 rounded-xl p-3 font-normal ring-1 ring-border has-[[data-state=checked]]:bg-accent has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-primary";

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && setOpen(o)}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost">
            <Undo2 aria-hidden="true" /> Withdraw
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Withdraw “{memory.title}”?</DialogTitle>
          <DialogDescription>
            It stops being used from now on. Anything already shared can’t be
            taken back.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={scope}
          onValueChange={(v) => setScope(v as Scope)}
          aria-label="What to stop"
          className="gap-2"
        >
          <Label htmlFor="withdraw-all" className={option}>
            <RadioGroupItem id="withdraw-all" value="all" />
            <span className="text-base">Stop all use</span>
          </Label>
          <Label htmlFor="withdraw-ai" className={option}>
            <RadioGroupItem id="withdraw-ai" value="ai" />
            <span className="text-base">Stop AI help only</span>
          </Label>
        </RadioGroup>

        <Disclosure summary="Details">
          <p>
            Blocks future releases and cancels queued AI work. It can’t recall
            previews already seen, PDFs already downloaded, or content already
            sent to an AI helper.
          </p>
          {plans.length + candidates.length + jobs.length === 0 ? (
            <p>Nothing currently depends on this memory.</p>
          ) : (
            <ul className="list-disc space-y-1 pl-4">
              {plans.map((p) => (
                <li key={p.id}>
                  Design revision {p.revision} will be invalidated
                </li>
              ))}
              {candidates.map((c) => (
                <li key={c.id}>
                  {c.status === "issued"
                    ? `Official edition ${c.editionId}: new downloads will be blocked${scope === "ai" ? " only if you stop all use" : ""}`
                    : `Draft edition ${c.editionId} will need a new design and fresh approvals`}
                </li>
              ))}
              {jobs.map((j) => (
                <li key={j.id}>Running job “{j.label}” will be cancelled</li>
              ))}
            </ul>
          )}
        </Disclosure>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending}>
              Keep it
            </Button>
          </DialogClose>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? "Withdrawing..." : "Withdraw"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
