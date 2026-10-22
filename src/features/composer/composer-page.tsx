import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Hand,
  LayoutTemplate,
  Lightbulb,
  Save,
  Undo2,
} from "lucide-react";
import { MemoryThumb } from "@/components/chorus/memory-thumb";
import { pageRoleLabel, ZinePage } from "@/components/chorus/zine-page";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  actions,
  getPrototypeState,
  usePrototype,
} from "@/features/prototype/store";
import {
  aiEligible,
  personById,
  planVisibleIds,
} from "@/features/prototype/selectors";
import type {
  Block,
  DesignPlan,
  Memory,
  Person,
  StyleTokens,
} from "@/features/prototype/types";
import { AiPanel } from "./ai-panel";
import {
  BlockInspector,
  PlanProvenance,
  StyleControls,
  ValidationList,
} from "./inspector";
import { ModeChooser } from "./mode-chooser";
import {
  computeBudget,
  hasAiLineage,
  originLabel,
  validatePlan,
} from "./plan-utils";
import { BudgetPanel, SourcesPanel } from "./sources-panel";

// CH-09 composer over the CH-20 plan contract. Edits stay in a local working
// copy (persisted per collection so a refresh keeps them) until saved as a new
// immutable revision. A draft is never an approved edition.

type Draft = { baseId: string | null; plan: DesignPlan };
type Panel = "edit" | "style" | "checks" | "info";

const draftKey = (collectionId: string) =>
  `chorus-composer-draft:${collectionId}`;

function loadDraft(collectionId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(collectionId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function storeDraft(collectionId: string, draft: Draft | null) {
  try {
    if (draft)
      window.localStorage.setItem(
        draftKey(collectionId),
        JSON.stringify(draft),
      );
    else window.localStorage.removeItem(draftKey(collectionId));
  } catch {
    // Storage unavailable: the draft survives only until refresh.
  }
}

const DESKTOP = "(min-width: 1024px)";

function useIsDesktop() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(DESKTOP);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      {children}
    </div>
  );
}

function InspirationCard({
  plan,
  memories,
}: {
  plan: DesignPlan;
  memories: Memory[];
}) {
  const visible = planVisibleIds(plan)
    .map((id) => memories.find((m) => m.id === id))
    .filter((m): m is Memory => Boolean(m));
  const styleOnly = plan.styleOnlyIds
    .map((id) => memories.find((m) => m.id === id))
    .filter((m): m is Memory => Boolean(m));
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Lightbulb className="size-4 text-primary" aria-hidden="true" />
        Inspiration · {plan.tokens.name}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {plan.inspiration}
      </p>
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-xs font-medium">
            On the pages ({visible.length})
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {visible.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-0.5 text-xs"
              >
                <MemoryThumb memory={m} className="size-5 rounded-full" />
                {m.title}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium">
            Style only ({styleOnly.length})
          </p>
          {styleOnly.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {styleOnly.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-1.5 rounded-full border border-dashed py-0.5 pr-2.5 pl-0.5 text-xs"
                >
                  <MemoryThumb memory={m} className="size-5 rounded-full" />
                  {m.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">None</p>
          )}
        </div>
      </div>
    </section>
  );
}

function PagePreview({
  plan,
  memories,
  people,
  pageIndex,
  onPage,
  selectedBlockId,
  onSelectBlock,
}: {
  plan: DesignPlan;
  memories: Memory[];
  people: Person[];
  pageIndex: number;
  onPage: (index: number) => void;
  selectedBlockId?: string;
  onSelectBlock: (id: string) => void;
}) {
  const page = plan.pages[pageIndex];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={pageIndex === 0}
          onClick={() => onPage(pageIndex - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <p className="text-sm font-medium" aria-live="polite">
          Page {pageIndex + 1} of {plan.pages.length} ·{" "}
          {page ? pageRoleLabel[page.role] : ""}
        </p>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={pageIndex >= plan.pages.length - 1}
          onClick={() => onPage(pageIndex + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      {page && (
        <div className="mx-auto w-full max-w-[400px]">
          <ZinePage
            page={page}
            pageNumber={pageIndex + 1}
            tokens={plan.tokens}
            memories={memories}
            people={people}
            selectedBlockId={selectedBlockId}
            onSelectBlock={onSelectBlock}
          />
        </div>
      )}
      <ol
        aria-label="All pages"
        className="grid grid-cols-3 gap-3 sm:grid-cols-6"
      >
        {plan.pages.map((p, i) => (
          <li key={i} className="space-y-1">
            <ZinePage
              page={p}
              pageNumber={i + 1}
              tokens={plan.tokens}
              memories={memories}
              people={people}
              className={cn(
                i === pageIndex &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-background",
              )}
              overlay={
                <button
                  type="button"
                  onClick={() => onPage(i)}
                  aria-current={i === pageIndex ? "page" : undefined}
                  aria-label={`Show page ${i + 1}: ${pageRoleLabel[p.role]}`}
                  className="absolute inset-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                />
              }
            />
            <p className="truncate text-center text-[11px] text-muted-foreground">
              {i + 1}. {pageRoleLabel[p.role]}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ComposerPage({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  const isDesktop = useIsDesktop();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [draft, setDraftState] = useState<Draft | null>(() =>
    loadDraft(collectionId),
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedBlockId, setSelectedBlockId] = useState<string>();
  const [savedRevision, setSavedRevision] = useState<number | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("edit");

  const collection = state.collections.find((c) => c.id === collectionId);
  const memories = useMemo(
    () => state.memories.filter((m) => m.collectionId === collectionId),
    [state.memories, collectionId],
  );
  const people = (collection?.memberIds ?? []).map((id) =>
    personById(state, id),
  );
  const plans = state.plans.filter((p) => p.collectionId === collectionId);
  const jobs = state.jobs.filter((j) => j.collectionId === collectionId);
  const designer = state.processors.find((p) => p.id === "designer");
  const aiEnabled = state.aiConfig.enabled;
  const eligible = memories.filter(aiEligible);
  const budget = computeBudget(eligible);

  const sorted = [...plans].sort((a, b) => b.revision - a.revision);
  const defaultPlan = sorted.find((p) => !p.invalidatedReason) ?? sorted[0];
  const basePlan =
    (selectedPlanId && plans.find((p) => p.id === selectedPlanId)) ||
    defaultPlan;
  const plan = draft?.plan ?? basePlan;
  const draftBase = draft?.baseId
    ? plans.find((p) => p.id === draft.baseId)
    : undefined;
  const validation = plan ? validatePlan(plan, memories) : [];
  const allPass = validation.every((r) => r.ok);
  const currentPage = plan?.pages[pageIndex];
  const selectedBlock = currentPage?.blocks.find(
    (b) => b.id === selectedBlockId,
  );
  const activeJob = jobs.some(
    (j) => j.status === "running" || j.status === "queued",
  );

  function setDraft(next: Draft | null) {
    setDraftState(next);
    storeDraft(collectionId, next);
  }

  function confirmDiscard() {
    return !draft || window.confirm("Discard your unsaved changes?");
  }

  function mutate(recipe: (plan: DesignPlan) => DesignPlan) {
    if (!plan) return;
    setSavedRevision(null);
    setDraft({
      baseId: draft ? draft.baseId : (basePlan?.id ?? null),
      plan: recipe(structuredClone(plan)),
    });
  }

  function updateBlock(block: Block) {
    mutate((p) => {
      const page = p.pages[pageIndex];
      page.blocks = page.blocks.map((b) => (b.id === block.id ? block : b));
      return p;
    });
  }

  function removeBlock() {
    if (!selectedBlockId) return;
    mutate((p) => {
      const page = p.pages[pageIndex];
      if (page.blocks.length > 1)
        page.blocks = page.blocks.filter((b) => b.id !== selectedBlockId);
      return p;
    });
    setSelectedBlockId(undefined);
  }

  function updateTokens(tokens: StyleTokens) {
    mutate((p) => ({ ...p, tokens }));
  }

  function selectRevision(id: string) {
    if (!confirmDiscard()) return;
    setDraft(null);
    setSelectedPlanId(id);
    setSelectedBlockId(undefined);
    setSavedRevision(null);
  }

  function openChooser() {
    if (!confirmDiscard()) return;
    setDraft(null);
    setChoosing(true);
    setAiMessage(null);
  }

  function startTemplate(templateId: string, empty: boolean) {
    const id = actions.startTemplate(collectionId, templateId, { empty });
    setDraft(null);
    setSelectedPlanId(id);
    setChoosing(false);
    setPageIndex(0);
    setSelectedBlockId(undefined);
    setSavedRevision(null);
  }

  function startAi() {
    const result = actions.generateDesign(collectionId);
    if (!result.ok) {
      setAiMessage(result.reason);
      return;
    }
    setAiMessage(null);
    setChoosing(false);
    setSelectedPlanId(null);
  }

  /**
   * Opens the last accepted design for hand editing. Assets, accepted text, and
   * AI/style-source lineage are kept; nothing is reset to a template.
   */
  function continueManually() {
    const accepted = basePlan ?? defaultPlan;
    if (!accepted) {
      setChoosing(true);
      return;
    }
    if (!draft)
      setDraft({ baseId: accepted.id, plan: structuredClone(accepted) });
    setChoosing(false);
    setSavedRevision(null);
  }

  function save() {
    if (!draft || !allPass) return;
    const id = actions.savePlanRevision(draft.plan);
    const saved = getPrototypeState().plans.find((p) => p.id === id);
    setDraft(null);
    setSelectedPlanId(null);
    setSavedRevision(saved?.revision ?? null);
  }

  function discard() {
    if (!confirmDiscard()) return;
    setDraft(null);
    setSelectedBlockId(undefined);
  }

  function goToPage(index: number) {
    setPageIndex(index);
    setSelectedBlockId(undefined);
  }

  const failing = validation.filter((r) => !r.ok).length;

  const toolbar = plan && (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2">
      {plans.length > 0 && (
        <Select
          value={draft ? "" : (basePlan?.id ?? "")}
          onValueChange={selectRevision}
        >
          <SelectTrigger aria-label="Design revision" className="h-8 w-56">
            <SelectValue
              placeholder={
                draftBase
                  ? `Editing revision ${draftBase.revision}`
                  : "Unsaved design"
              }
            />
          </SelectTrigger>
          <SelectContent>
            {sorted.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                Rev {p.revision} · {originLabel[p.origin]} · {p.tokens.name}
                {p.invalidatedReason ? " · invalid" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <span
        role="status"
        className={cn(
          "rounded-full px-2 py-0.5 text-xs",
          draft
            ? "bg-[var(--status-awaiting)]/10 text-[var(--status-awaiting)]"
            : "bg-muted text-muted-foreground",
        )}
      >
        {draft ? "Unsaved" : "Saved"}
      </span>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {draft ? (
          <>
            <Button size="sm" variant="ghost" onClick={discard}>
              <Undo2 aria-hidden="true" />
              Discard
            </Button>
            <Button size="sm" onClick={save} disabled={!allPass}>
              <Save aria-hidden="true" />
              Save
            </Button>
          </>
        ) : (
          <>
            {hasAiLineage(plan) && (
              <Button size="sm" variant="ghost" onClick={continueManually}>
                <Hand aria-hidden="true" />
                Edit by hand
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={openChooser}>
              <LayoutTemplate aria-hidden="true" />
              New design
            </Button>
            {allPass && (
              <Button asChild size="sm">
                <Link
                  to="/collections/$collectionId/edition"
                  params={{ collectionId }}
                >
                  Freeze
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            )}
          </>
        )}
      </div>
      {failing > 0 && (
        <button
          type="button"
          onClick={() => setPanel("checks")}
          className="w-full text-left text-xs text-[var(--status-excluded)] underline-offset-4 hover:underline"
        >
          {failing} check{failing === 1 ? "" : "s"} failing
          {plan.invalidatedReason ? ` · ${plan.invalidatedReason}` : ""}
        </button>
      )}
      {savedRevision !== null && !draft && (
        <p className="w-full text-xs text-[var(--status-available)]">
          Saved as revision {savedRevision}.
        </p>
      )}
    </div>
  );

  const leftRail = (
    <div className="space-y-4">
      {aiEnabled && (
        <Card>
          <AiPanel
            collectionId={collectionId}
            aiEnabled={aiEnabled}
            designer={designer}
            jobs={jobs}
            eligibleCount={eligible.length}
            overBudget={budget.over.length > 0}
            hasPlan={plans.length > 0}
            onManual={continueManually}
          />
          <details className="mt-3 border-t pt-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              AI budget
            </summary>
            <div className="mt-3">
              <BudgetPanel budget={budget} />
            </div>
          </details>
        </Card>
      )}
      <Card>
        <h3 className="mb-3 text-sm font-semibold">Memories</h3>
        <SourcesPanel
          memories={memories}
          plan={plan}
          collectionId={collectionId}
        />
      </Card>
    </div>
  );

  const chooser = (
    <div className="space-y-3">
      <ModeChooser
        state={state}
        collectionId={collectionId}
        memories={memories}
        people={people}
        aiEnabled={aiEnabled}
        aiEligibleCount={eligible.length}
        aiBlockedReason={
          activeJob
            ? "An AI job is already running for this collection."
            : budget.over.length
              ? `Over the AI budget (${budget.over.join(", ")}). Reduce the selection first.`
              : undefined
        }
        onTemplate={startTemplate}
        onAi={startAi}
        onBack={plan ? () => setChoosing(false) : undefined}
      />
      {aiMessage && (
        <p role="alert" className="text-xs text-[var(--status-excluded)]">
          {aiMessage}
        </p>
      )}
    </div>
  );

  const center =
    plan && !choosing ? (
      <PagePreview
        plan={plan}
        memories={memories}
        people={people}
        pageIndex={Math.min(pageIndex, plan.pages.length - 1)}
        onPage={goToPage}
        selectedBlockId={selectedBlockId}
        onSelectBlock={(id) => {
          setSelectedBlockId(id);
          setPanel("edit");
        }}
      />
    ) : (
      chooser
    );

  const rightPanel = plan && (
    <Card className="p-3">
      <Tabs value={panel} onValueChange={(v) => setPanel(v as Panel)}>
        <TabsList className="w-full">
          <TabsTrigger value="edit">Edit</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
          <TabsTrigger value="checks">
            Checks
            {failing > 0 && (
              <span className="ml-1 rounded-full bg-[var(--status-excluded)] px-1.5 text-[10px] text-white">
                {failing}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>
        <TabsContent value="edit" className="pt-3">
          <BlockInspector
            block={selectedBlock}
            memories={memories}
            people={people}
            collectionId={collectionId}
            onChange={updateBlock}
            onRemove={removeBlock}
            canRemove={(currentPage?.blocks.length ?? 0) > 1}
          />
        </TabsContent>
        <TabsContent value="style" className="pt-3">
          <StyleControls tokens={plan.tokens} onChange={updateTokens} />
        </TabsContent>
        <TabsContent value="checks" className="pt-3">
          <ValidationList rows={validation} />
        </TabsContent>
        <TabsContent value="info" className="space-y-5 pt-3">
          <PlanProvenance plan={plan} isDraft={Boolean(draft)} />
          <InspirationCard plan={plan} memories={memories} />
        </TabsContent>
      </Tabs>
    </Card>
  );

  if (!collection) return null;

  if (isDesktop)
    return (
      <div className="space-y-4">
        {!choosing && toolbar}
        <div className="grid grid-cols-[240px_minmax(0,1fr)_300px] gap-5">
          <aside aria-label="Memories" className="min-w-0">
            {leftRail}
          </aside>
          <section aria-label="Pages" className="min-w-0">
            {center}
          </section>
          <aside aria-label="Edit and style" className="min-w-0">
            {!choosing && rightPanel}
          </aside>
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      {!choosing && toolbar}
      {center}
      {!choosing && rightPanel}
      {leftRail}
    </div>
  );
}
