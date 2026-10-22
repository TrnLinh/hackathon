import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { ZinePage } from "@/components/chorus/zine-page";
import { Button } from "@/components/ui/button";
import { shortDigest } from "@/features/prototype/selectors";
import type { DesignPlan, PrototypeState } from "@/features/prototype/types";

export function DigestRow({
  label,
  digest,
}: {
  label: string;
  digest: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5">
        <code
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs"
          title={digest}
        >
          {shortDigest(digest)}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={`Copy full ${label.toLowerCase()}`}
          onClick={() => {
            void navigator.clipboard?.writeText(digest).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
        <span role="status" className="sr-only">
          {copied ? "Copied" : ""}
        </span>
      </dd>
    </div>
  );
}

export function PlanPages({
  plan,
  state,
  editionId,
}: {
  plan: DesignPlan;
  state: PrototypeState;
  editionId?: string;
}) {
  return (
    <ol
      className="grid grid-cols-2 gap-4 sm:grid-cols-3"
      aria-label="Photozine pages"
    >
      {plan.pages.map((page, i) => (
        <li key={i}>
          <ZinePage
            page={page}
            pageNumber={i + 1}
            tokens={plan.tokens}
            memories={state.memories}
            people={state.people}
            overlay={
              editionId && i === 0 ? (
                <span className="absolute top-[3cqw] right-[3cqw] rounded bg-black/55 px-[1.5cqw] font-mono text-[max(8px,2.2cqw)] text-white">
                  {editionId}
                </span>
              ) : undefined
            }
          />
        </li>
      ))}
    </ol>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-lg font-semibold tracking-tight">{children}</h2>;
}
