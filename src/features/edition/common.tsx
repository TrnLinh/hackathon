import { useState } from "react";
import { Check, Copy, Sparkles, LayoutTemplate } from "lucide-react";
import { ZinePage } from "@/components/chorus/zine-page";
import { Button } from "@/components/ui/button";
import { shortDigest } from "@/features/prototype/selectors";
import { templateById } from "@/features/prototype/templates";
import type { DesignPlan, PrototypeState } from "@/features/prototype/types";

const originLabel: Record<DesignPlan["origin"], string> = {
  template: "Template",
  ai: "Made with AI",
  refinement: "Refined with AI",
  manual: "Hand-made layout",
};

/** Human-readable creation provenance (FR-33). */
export function originSummary(plan: DesignPlan) {
  const template = templateById(plan.templateId);
  const base = template
    ? `${originLabel[plan.origin]}: ${template.name} v${template.version}`
    : originLabel[plan.origin];
  const edited =
    plan.parentRevision !== undefined
      ? `, edited from version ${plan.parentRevision}`
      : "";
  return `${base}${edited}`;
}

/** Manifest rows describing where a plan came from. */
export function ProvenanceRows({ plan }: { plan: DesignPlan }) {
  const template = templateById(plan.templateId);
  const aiLineage =
    plan.aiLineage || plan.origin === "ai" || plan.origin === "refinement";
  const Icon = aiLineage ? Sparkles : LayoutTemplate;
  return (
    <>
      <Row label="Made as">
        <span className="inline-flex items-center gap-1.5">
          <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {originLabel[plan.origin]}
        </span>
      </Row>
      <Row label="Template">
        {template ? `${template.name} · v${template.version}` : "None"}
      </Row>
      <Row label="Based on">
        {plan.parentRevision !== undefined
          ? `Version ${plan.parentRevision}`
          : "Original"}
      </Row>
      <Row label="AI help">
        {aiLineage
          ? "Yes. AI helped shape this design."
          : "No. Built without AI."}
      </Row>
    </>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 py-2 sm:grid-cols-[140px_minmax(0,1fr)]">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

/** Operational AI changes never touch frozen candidates (FR-35, AT-25). */
export const aiToggleNote =
  "Turning AI on or off never changes a locked edition. Only edits create a new draft.";

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
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5">
        <code
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm"
          title={digest}
        >
          {shortDigest(digest)}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Copy ${label.toLowerCase()}`}
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
      className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 lg:grid-cols-6"
      aria-label="Photozine pages"
    >
      {plan.pages.map((page, i) => (
        <li
          key={i}
          style={{ "--i": i } as React.CSSProperties}
          className={`pop w-[58%] max-w-60 shrink-0 snap-start overflow-hidden rounded-xl shadow-lift md:w-auto md:max-w-none ${i % 2 ? "md:rotate-1" : "md:-rotate-1"}`}
        >
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
  return <h2 className="text-xl font-semibold tracking-tight">{children}</h2>;
}
