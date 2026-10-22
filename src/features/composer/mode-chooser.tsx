import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, LayoutTemplate, PowerOff, Sparkles } from "lucide-react";
import { ZinePage } from "@/components/chorus/zine-page";
import { Button } from "@/components/ui/button";
import { buildTemplatePlan, templates } from "@/features/prototype/templates";
import type {
  Memory,
  Person,
  PrototypeState,
} from "@/features/prototype/types";

// Entry point for a new design (CH-09). Templates are the default and never
// contact a model; Create with AI appears enabled only when the server reports
// AI as on and at least one memory has AI permission (CH-22).

export function ModeChooser({
  state,
  collectionId,
  memories,
  people,
  aiEnabled,
  aiEligibleCount,
  aiBlockedReason,
  onTemplate,
  onAi,
  onBack,
}: {
  state: PrototypeState;
  collectionId: string;
  memories: Memory[];
  people: Person[];
  aiEnabled: boolean;
  aiEligibleCount: number;
  /** Extra reason AI can't start, such as a running job or budget overrun. */
  aiBlockedReason?: string;
  onTemplate: (templateId: string, empty: boolean) => void;
  onAi: () => void;
  onBack?: () => void;
}) {
  // Preview covers built locally; nothing is saved until the creator picks.
  const previews = useMemo(
    () =>
      templates.map((t) => ({
        template: t,
        plan: buildTemplatePlan(state, collectionId, t.id, {
          id: `preview-${t.id}`,
          revision: 0,
        }),
      })),
    [state, collectionId],
  );
  const aiReason = !aiEnabled
    ? "AI is turned off for this workspace — templates work without it."
    : aiEligibleCount === 0
      ? "No memories have AI permission yet."
      : aiBlockedReason;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl tracking-tight">
            Start a new design
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Pick a template and arrange the memories yourself, or let AI propose
            a design. Both use the same editor, checks, and PDF renderer.
          </p>
        </div>
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            Back to current design
          </Button>
        )}
      </div>

      <section aria-labelledby="template-heading" className="space-y-3">
        <h3
          id="template-heading"
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <LayoutTemplate className="size-4 text-primary" aria-hidden="true" />
          Use a template
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
            Default · no AI
          </span>
        </h3>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {previews.map(({ template, plan }) => (
            <li
              key={template.id}
              className="flex flex-col gap-3 rounded-xl border bg-card p-3"
            >
              <div className="mx-auto w-full max-w-[180px]">
                <ZinePage
                  page={plan.pages[0]}
                  pageNumber={1}
                  tokens={plan.tokens}
                  memories={memories}
                  people={people}
                />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">
                  {template.name}{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    v{template.version}
                  </span>
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {template.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => onTemplate(template.id, false)}
                  aria-label={`Fill ${template.name} with approved memories`}
                >
                  Fill with approved memories
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onTemplate(template.id, true)}
                  aria-label={`Start ${template.name} empty`}
                >
                  Start empty
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">
          Templates only use memories approved for manual use. No AI decision,
          model, or credential is needed.
        </p>
      </section>

      <section
        aria-labelledby="ai-mode-heading"
        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed bg-card/60 p-4"
      >
        <div className="min-w-0">
          <h3
            id="ai-mode-heading"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            {aiEnabled ? (
              <Sparkles className="size-4 text-primary" aria-hidden="true" />
            ) : (
              <PowerOff
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            )}
            Create with AI
            <span className="text-xs font-normal text-muted-foreground">
              Optional
            </span>
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {aiReason ? (
              <>
                {aiReason}{" "}
                {!aiEnabled && (
                  <Link
                    to="/processors"
                    className="underline underline-offset-2"
                  >
                    AI processors
                  </Link>
                )}
              </>
            ) : (
              `Proposes a six-page design from ${aiEligibleCount} memor${aiEligibleCount === 1 ? "y" : "ies"} with AI permission. You can edit everything afterwards.`
            )}
          </p>
        </div>
        <Button variant="outline" disabled={Boolean(aiReason)} onClick={onAi}>
          <Sparkles aria-hidden="true" />
          Create with AI
        </Button>
      </section>
    </div>
  );
}
