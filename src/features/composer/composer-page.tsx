import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  Hand,
  LayoutTemplate,
  Lightbulb,
  Save,
  Undo2,
} from "lucide-react";
import { MemoryThumb } from "@/components/chorus/memory-thumb";
import { TrustNote } from "@/components/chorus/page-header";
import { pageRoleLabel, ZinePage } from "@/components/chorus/zine-page";
import { Button } from "@/components/ui/button";
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
import { AiPanel, RevisionList } from "./ai-panel";
import {
  BlockInspector,
  PlanProvenance,
  StyleControls,
  ValidationList,
} from "./inspector";
import { ModeChooser } from "./mode-chooser";
import { computeBudget, hasAiLineage, validatePlan } from "./plan-utils";
import { BudgetPanel, SourcesPanel } from "./sources-panel";

// CH-09 composer over the CH-20 plan contract. Edits stay in a local working
// copy (persisted per collection so a refresh keeps them) until saved as a new
// immutable revision. A draft is never an approved edition.

type Draft = { baseId: string | null; plan: DesignPlan };

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
    <Card className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Lightbulb className="size-4 text-primary" aria-hidden="true" />
        Inspiration · {plan.tokens.name}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {plan.inspiration}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
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
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Style-only sources shaped the palette or layout without appearing on
            a page. Their contributors still approve the final edition.
          </p>
        </div>
      </div>
    </Card>
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

  const aiPanel = (
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
  );

  const leftRail = (
    <div className="space-y-5">
      <Card>{aiPanel}</Card>
      {aiEnabled && (
        <Card>
          <BudgetPanel budget={budget} />
        </Card>
      )}
      {plans.length > 0 && (
        <Card>
          <RevisionList
            plans={plans}
            selectedId={draft ? undefined : basePlan?.id}
            onSelect={selectRevision}
          />
        </Card>
      )}
      <Card>
        <h3 className="mb-3 text-sm font-semibold">Sources</h3>
        <SourcesPanel
          memories={memories}
          plan={plan}
          collectionId={collectionId}
        />
      </Card>
    </div>
  );

  const toolbar = plan && (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
      <p className="text-sm" role="status">
        {draft ? (
          <>
            <span className="font-medium">Unsaved changes</span>
            <span className="text-muted-foreground">
              {" "}
              ·{" "}
              {draftBase
                ? `based on revision ${draftBase.revision}`
                : "new design"}
            </span>
          </>
        ) : (
          <>
            <span className="font-medium">Revision {plan.revision}</span>
            <span className="text-muted-foreground">
              {" "}
              · saved, read-only until you edit
            </span>
          </>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        {draft && (
          <>
            <Button size="sm" variant="ghost" onClick={discard}>
              <Undo2 aria-hidden="true" />
              Discard changes
            </Button>
            <Button size="sm" onClick={save} disabled={!allPass}>
              <Save aria-hidden="true" />
              Save as new revision
            </Button>
          </>
        )}
        {!draft && hasAiLineage(plan) && (
          <Button size="sm" variant="outline" onClick={continueManually}>
            <Hand aria-hidden="true" />
            Continue manually
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={openChooser}>
          <LayoutTemplate aria-hidden="true" />
          New design
        </Button>
      </div>
      {!draft && hasAiLineage(plan) && (
        <p className="w-full text-xs leading-relaxed text-muted-foreground">
          Continue manually keeps this accepted design, its assets and text, and
          its full AI and style-source lineage. Style-only sources still need
          final approval. It works whether or not AI is on.
        </p>
      )}
      {draft && !allPass && (
        <p className="w-full text-xs text-[var(--status-excluded)]">
          Fix the failing plan checks before saving.
          {plan.invalidatedReason &&
            " This design depends on a source that changed or was withdrawn: start a new design from a template, or generate again if AI is on."}
        </p>
      )}
    </div>
  );

  const freezeCallout = plan && !draft && allPass && (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--status-available)]/30 bg-[var(--status-available)]/5 px-4 py-3">
      <p className="flex items-center gap-2 text-sm">
        <BookOpenCheck
          className="size-4 text-[var(--status-available)]"
          aria-hidden="true"
        />
        <span>
          <span className="font-medium">Ready to freeze.</span>{" "}
          {savedRevision !== null && `Saved as revision ${savedRevision}. `}
          Freezing creates an exact PDF candidate for final approval.
        </span>
      </p>
      <Button asChild size="sm" variant="outline">
        <Link to="/collections/$collectionId/edition" params={{ collectionId }}>
          Go to edition <ArrowRight aria-hidden="true" />
        </Link>
      </Button>
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
      <div className="space-y-5">
        {toolbar}
        {freezeCallout}
        <PagePreview
          plan={plan}
          memories={memories}
          people={people}
          pageIndex={Math.min(pageIndex, plan.pages.length - 1)}
          onPage={goToPage}
          selectedBlockId={selectedBlockId}
          onSelectBlock={setSelectedBlockId}
        />
        <InspirationCard plan={plan} memories={memories} />
      </div>
    ) : (
      chooser
    );

  const inspector = plan && (
    <Card>
      <BlockInspector
        block={selectedBlock}
        memories={memories}
        people={people}
        collectionId={collectionId}
        onChange={updateBlock}
        onRemove={removeBlock}
        canRemove={(currentPage?.blocks.length ?? 0) > 1}
      />
    </Card>
  );

  const provenance = plan && (
    <Card>
      <PlanProvenance plan={plan} isDraft={Boolean(draft)} />
    </Card>
  );

  const styleAndChecks = plan && (
    <>
      <Card>
        <StyleControls tokens={plan.tokens} onChange={updateTokens} />
      </Card>
      <Card>
        <ValidationList rows={validation} />
      </Card>
    </>
  );

  const trustNotes = (
    <div className="space-y-2">
      <TrustNote>
        AI returns a structured design plan only. It never supplies code,
        external URLs, or the final PDF; a validated local renderer builds every
        page.
      </TrustNote>
      <TrustNote>
        Templates are a complete path on their own and never contact a model. AI
        is optional for each design and can be turned off by an operator without
        affecting templates, accepted designs, or approvals. Declined,
        withdrawn, or pending memories never appear in or influence the design.
      </TrustNote>
      <TrustNote>
        Prototype: designs are simulated in this browser and no processor is
        contacted.
      </TrustNote>
    </div>
  );

  if (!collection) return null;

  if (isDesktop)
    return (
      <div className="grid grid-cols-[260px_minmax(0,1fr)_280px] gap-6">
        <aside aria-label="Sources and AI" className="min-w-0">
          {leftRail}
        </aside>
        <section aria-label="Pages" className="min-w-0">
          {center}
        </section>
        <aside aria-label="Inspector and style" className="min-w-0 space-y-5">
          {inspector}
          {provenance}
          {styleAndChecks}
          {trustNotes}
        </aside>
      </div>
    );

  return (
    <Tabs defaultValue="pages">
      <TabsList className="w-full">
        <TabsTrigger value="pages">Pages</TabsTrigger>
        <TabsTrigger value="sources">Sources</TabsTrigger>
        <TabsTrigger value="style">Style</TabsTrigger>
      </TabsList>
      <TabsContent value="pages" className="space-y-5 pt-2">
        {center}
        {inspector}
        {provenance}
      </TabsContent>
      <TabsContent value="sources" className="pt-2">
        {leftRail}
      </TabsContent>
      <TabsContent value="style" className="space-y-5 pt-2">
        {styleAndChecks ?? (
          <p className="text-sm text-muted-foreground">
            Start a design from a template to adjust its style.
          </p>
        )}
        {trustNotes}
      </TabsContent>
    </Tabs>
  );
}
