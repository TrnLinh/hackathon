import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles } from "lucide-react";
import { ZinePage } from "@/components/chorus/zine-page";
import { Button } from "@/components/ui/button";
import { buildTemplatePlan, templates } from "@/features/prototype/templates";
import type {
  Memory,
  Person,
  PrototypeState,
} from "@/features/prototype/types";

// Entry point for a new design. Templates are the default and never contact a
// model; AI is enabled only when the server reports it on and a memory allows it.

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
    ? "AI is off. Templates work the same."
    : aiEligibleCount === 0
      ? "No memories allow AI yet."
      : aiBlockedReason;

  return (
    <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Design your zine
        </h2>
        {onBack && (
          <Button variant="ghost" onClick={onBack}>
            <ArrowLeft aria-hidden="true" />
            Back
          </Button>
        )}
      </div>

      <section aria-labelledby="template-heading" className="space-y-3">
        <h3
          id="template-heading"
          className="flex items-center gap-2 text-xl font-semibold"
        >
          Use a template
          <span className="rounded-full bg-lime px-2.5 py-0.5 text-sm font-medium text-lime-ink">
            Default
          </span>
        </h3>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {previews.map(({ template, plan }, i) => (
            <li
              key={template.id}
              className="rise press flex flex-col gap-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border transition-shadow hover:shadow-lift"
              style={{ "--i": i } as React.CSSProperties}
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
                <p className="text-base font-semibold">{template.name}</p>
                <p className="text-sm text-muted-foreground">
                  {template.description}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="flex-1"
                  onClick={() => onTemplate(template.id, false)}
                  aria-label={`Fill ${template.name} with approved memories`}
                >
                  Fill with memories
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => onTemplate(template.id, true)}
                  aria-label={`Start ${template.name} empty`}
                >
                  Start empty
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="ai-mode-heading"
        className="rise flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-card p-5 shadow-soft ring-1 ring-border"
      >
        <div className="min-w-0">
          <h3
            id="ai-mode-heading"
            className="flex items-center gap-2 text-xl font-semibold"
          >
            <Sparkles
              className={
                aiReason
                  ? "size-4 text-muted-foreground"
                  : "size-4 text-primary"
              }
              aria-hidden="true"
            />
            Create with AI
          </h3>
          <p className="text-sm text-muted-foreground">
            {aiReason ?? "Let AI propose a design. You can edit it after."}{" "}
            {!aiEnabled && (
              <Link to="/processors" className="underline underline-offset-2">
                AI helpers
              </Link>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="lg"
          disabled={Boolean(aiReason)}
          onClick={onAi}
        >
          <Sparkles aria-hidden="true" />
          Create with AI
        </Button>
      </section>
    </div>
  );
}
