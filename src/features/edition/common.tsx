import { useState } from "react";
import { Check, Copy, Sparkles, LayoutTemplate } from "lucide-react";
import { ZinePage } from "@/components/chorus/zine-page";
import { Button } from "@/components/ui/button";
import { shortDigest } from "@/features/prototype/selectors";
import { templateById } from "@/features/prototype/templates";
import type { DesignPlan, PrototypeState } from "@/features/prototype/types";

const originLabel: Record<DesignPlan["origin"], string> = {
  template: "Template",
  ai: "AI-generated",
  refinement: "AI refinement",
  manual: "Manual layout",
};

/** Human-readable creation provenance (FR-33). */
export function originSummary(plan: DesignPlan) {
  const template = templateById(plan.templateId);
  const base = template
    ? `${originLabel[plan.origin]}: ${template.name} v${template.version}`
    : originLabel[plan.origin];
  const edited =
    plan.parentRevision !== undefined
      ? `, edited from revision ${plan.parentRevision}`
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
      <Row label="Created as">
        <span className="inline-flex items-center gap-1.5">
          <Icon className="size-3.5 text-muted-foreground" aria-hidden="true" />
          {originLabel[plan.origin]}
        </span>
      </Row>
      <Row label="Template">
        {template ? `${template.name} · v${template.version}` : "None"}
      </Row>
      <Row label="Parent revision">
        {plan.parentRevision !== undefined
          ? `Revision ${plan.parentRevision}`
          : "None (original)"}
      </Row>
      <Row label="AI lineage">
        {aiLineage
          ? "Yes. AI shaped this design; its source and style dependencies are kept even after manual edits."
          : "No. Built without any AI processing."}
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
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

/** Operational AI changes never touch frozen candidates (FR-35, AT-25). */
export const aiToggleNote =
  "Turning AI on or off never changes frozen bytes, approvals, receipts, or downloads. Only content or layout edits create a new candidate.";

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
