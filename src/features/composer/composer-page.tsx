import { useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Ban,
  ChevronLeft,
  ChevronRight,
  Hand,
  Images,
  LayoutTemplate,
  Lightbulb,
  Lock,
  MoreHorizontal,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  RefreshCw,
  Save,
  Undo2,
} from "lucide-react";
import { MemoryThumb } from "@/components/chorus/memory-thumb";
import { Disclosure } from "@/components/chorus/primitives";
import { pageRoleLabel, ZinePage } from "@/components/chorus/zine-page";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { ConvexComposer } from "./convex-composer";

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

const DESKTOP = "(min-width: 768px)";
type SheetKind = "memories" | "style" | "edit" | null;

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
    <div
      className={cn(
        "rounded-2xl bg-card p-4 shadow-soft ring-1 ring-border",
        className,
      )}
    >
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
        {plan.tokens.name}
      </h3>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {plan.inspiration}
      </p>
      <div className="space-y-3">
        <div>
          <p className="mb-1.5 text-sm font-medium">
            On the pages ({visible.length})
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {visible.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-2.5 pl-0.5 text-sm"
              >
                <MemoryThumb memory={m} className="size-5 rounded-full" />
                {m.title}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">
            Style only ({styleOnly.length})
          </p>
          {styleOnly.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {styleOnly.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center gap-1.5 rounded-full bg-muted py-0.5 pr-2.5 pl-0.5 text-xs"
                >
                  <MemoryThumb memory={m} className="size-5 rounded-full" />
                  {m.title}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None</p>
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
    <div className="space-y-4 rounded-[2rem] bg-gradient-to-b from-accent/70 to-transparent p-4 md:p-6">
      {page && (
        <div className="mx-auto w-full max-w-[min(400px,calc(100dvh-22rem))] min-w-[240px] animate-in fade-in-0 shadow-lift duration-200 md:max-w-[min(440px,calc(100dvh-16rem))]">
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
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous page"
          disabled={pageIndex === 0}
          onClick={() => onPage(pageIndex - 1)}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>
        <p
          className="tabular min-w-32 text-center text-sm font-medium"
          aria-live="polite"
        >
          Page {pageIndex + 1} of {plan.pages.length}
          <span className="block text-muted-foreground">
            {page ? pageRoleLabel[page.role] : ""}
          </span>
        </p>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next page"
          disabled={pageIndex >= plan.pages.length - 1}
          onClick={() => onPage(pageIndex + 1)}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

export function ComposerPage({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  return state.collections.some((c) => c.id === collectionId) ? (
    <PrototypeComposerPage collectionId={collectionId} />
  ) : (
    <ConvexComposer collectionId={collectionId} />
  );
}

function PrototypeComposerPage({ collectionId }: { collectionId: string }) {
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
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [railOpen, setRailOpen] = useState(true);

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
  const validation = plan
    ? validatePlan(plan, memories, collection?.memberIds)
    : [];
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
  const designJob = jobs
    .filter((j) => j.processorId === "designer")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const runningJob =
    designJob?.status === "running" || designJob?.status === "queued"
      ? designJob
      : undefined;
  const failedJob = designJob?.status === "failed" ? designJob : undefined;

  const topRow = plan && (
    <div className="flex items-center gap-2">
      {plans.length > 0 && (
        <Select
          value={draft ? "" : (basePlan?.id ?? "")}
          onValueChange={selectRevision}
        >
          <SelectTrigger
            aria-label="Design revision"
            className="h-11 min-h-11 min-w-0 flex-1 rounded-full md:max-w-64 md:flex-none"
          >
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
                Revision {p.revision}, {originLabel[p.origin]}, {p.tokens.name}
                {p.invalidatedReason ? ", needs a fix" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <div className="ml-auto flex items-center gap-2">
        {draft ? (
          <Button size="lg" onClick={save} disabled={!allPass}>
            <Save aria-hidden="true" />
            Save
          </Button>
        ) : allPass ? (
          <Button asChild size="lg" variant="highlight">
            <Link
              to="/collections/$collectionId/edition"
              params={{ collectionId }}
            >
              <Lock aria-hidden="true" />
              Lock this version
            </Link>
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={() => {
              setPanel("checks");
              setSheet("edit");
            }}
          >
            Fix {failing} check{failing === 1 ? "" : "s"}
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More actions">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {draft && (
              <DropdownMenuItem onSelect={discard}>
                <Undo2 aria-hidden="true" />
                Discard changes
              </DropdownMenuItem>
            )}
            {!draft && hasAiLineage(plan) && (
              <DropdownMenuItem onSelect={continueManually}>
                <Hand aria-hidden="true" />
                Edit by hand
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={openChooser}>
              <LayoutTemplate aria-hidden="true" />
              New design
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  const statusLine = (runningJob ||
    failedJob ||
    (savedRevision !== null && !draft)) && (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 rounded-2xl bg-card px-4 py-2 text-sm shadow-soft ring-1 ring-border animate-in fade-in-0 duration-200"
    >
      {runningJob ? (
        <>
          <span className="flex-1">AI is designing your zine</span>
          <Button
            variant="ghost"
            onClick={() => actions.cancelJob(runningJob.id)}
          >
            <Ban aria-hidden="true" />
            Cancel
          </Button>
        </>
      ) : failedJob ? (
        <>
          <span className="flex-1">The AI design did not finish</span>
          {aiEnabled && (
            <Button
              variant="ghost"
              disabled={activeJob || budget.over.length > 0}
              onClick={() => actions.generateDesign(collectionId)}
            >
              <RefreshCw aria-hidden="true" />
              Retry
            </Button>
          )}
          <Button variant="ghost" onClick={continueManually}>
            <Hand aria-hidden="true" />
            Continue manually
          </Button>
        </>
      ) : (
        <span className="text-[var(--status-available)]">
          Saved as revision {savedRevision}
        </span>
      )}
    </div>
  );

  const sources = plan && (
    <div className="space-y-4">
      <SourcesPanel
        memories={memories}
        plan={plan}
        collectionId={collectionId}
      />
      {aiEnabled && (
        <Disclosure summary="Let AI help (optional)">
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
          <BudgetPanel budget={budget} />
        </Disclosure>
      )}
    </div>
  );

  const editBody = plan && (
    <BlockInspector
      block={selectedBlock}
      memories={memories}
      people={people}
      collectionId={collectionId}
      onChange={updateBlock}
      onRemove={removeBlock}
      canRemove={(currentPage?.blocks.length ?? 0) > 1}
    />
  );

  const infoBody = plan && (
    <div className="space-y-4">
      <InspirationCard plan={plan} memories={memories} />
      <Disclosure summary="Details">
        <PlanProvenance plan={plan} isDraft={Boolean(draft)} />
      </Disclosure>
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
            ? "An AI job is already running."
            : budget.over.length
              ? `Over the AI limit (${budget.over.join(", ")}). Pick fewer memories.`
              : undefined
        }
        onTemplate={startTemplate}
        onAi={startAi}
        onBack={plan ? () => setChoosing(false) : undefined}
      />
      {aiMessage && (
        <p role="alert" className="text-sm text-[var(--status-excluded)]">
          {aiMessage}
        </p>
      )}
    </div>
  );

  if (!collection) return null;

  if (!plan || choosing) return chooser;

  const preview = (
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
        if (!isDesktop) setSheet("edit");
      }}
    />
  );

  if (isDesktop)
    return (
      <div className="space-y-4">
        {topRow}
        {statusLine}
        <div
          className={cn(
            "grid gap-6",
            railOpen
              ? "grid-cols-[260px_minmax(0,1fr)_320px]"
              : "grid-cols-[44px_minmax(0,1fr)_320px]",
          )}
        >
          <aside aria-label="Memories" className="min-w-0">
            <div className="mb-2 flex items-center justify-between">
              {railOpen && (
                <h2 className="text-base font-semibold">Memories</h2>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label={railOpen ? "Hide memories" : "Show memories"}
                aria-expanded={railOpen}
                onClick={() => setRailOpen((v) => !v)}
              >
                {railOpen ? (
                  <PanelLeftClose aria-hidden="true" />
                ) : (
                  <PanelLeftOpen aria-hidden="true" />
                )}
              </Button>
            </div>
            {railOpen && sources}
          </aside>
          <section aria-label="Pages" className="min-w-0">
            {preview}
          </section>
          <aside aria-label="Style and edit" className="min-w-0">
            <Card className="p-3">
              <Tabs value={panel} onValueChange={(v) => setPanel(v as Panel)}>
                <TabsList className="h-auto w-full rounded-full p-1">
                  <TabsTrigger value="style" className="h-10 rounded-full px-3">
                    Style
                  </TabsTrigger>
                  <TabsTrigger value="edit" className="h-10 rounded-full px-3">
                    Edit
                  </TabsTrigger>
                  <TabsTrigger
                    value="checks"
                    className="h-10 rounded-full px-3"
                  >
                    Checks
                    {failing > 0 && (
                      <span className="tabular ml-1 rounded-full bg-[var(--status-excluded)] px-1.5 text-[10px] text-white">
                        {failing}
                      </span>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="info" className="h-10 rounded-full px-3">
                    Info
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="style" className="pt-3">
                  <StyleControls tokens={plan.tokens} onChange={updateTokens} />
                </TabsContent>
                <TabsContent value="edit" className="pt-3">
                  {editBody}
                </TabsContent>
                <TabsContent value="checks" className="pt-3">
                  <ValidationList rows={validation} />
                </TabsContent>
                <TabsContent value="info" className="pt-3">
                  {infoBody}
                </TabsContent>
              </Tabs>
            </Card>
          </aside>
        </div>
      </div>
    );

  const tools: {
    key: Exclude<SheetKind, null>;
    label: string;
    icon: ReactNode;
  }[] = [
    { key: "memories", label: "Memories", icon: <Images aria-hidden="true" /> },
    { key: "style", label: "Style", icon: <Palette aria-hidden="true" /> },
    { key: "edit", label: "Edit", icon: <Pencil aria-hidden="true" /> },
  ];

  return (
    <div className="space-y-4 pb-2">
      {topRow}
      {statusLine}
      {preview}
      <nav
        aria-label="Design tools"
        className="sticky bottom-[calc(var(--nav-bottom)+env(safe-area-inset-bottom)+0.75rem)] z-30 grid grid-cols-3 gap-1 rounded-3xl bg-card/95 p-1.5 shadow-lift ring-1 ring-border backdrop-blur"
      >
        {tools.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSheet(t.key)}
            className="press flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-5"
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
      <Sheet open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-3xl"
        >
          <SheetHeader>
            <SheetTitle>
              {sheet === "memories"
                ? "Memories"
                : sheet === "style"
                  ? "Style"
                  : "Edit"}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Design tools for this zine
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            {sheet === "memories" && sources}
            {sheet === "style" && (
              <StyleControls tokens={plan.tokens} onChange={updateTokens} />
            )}
            {sheet === "edit" && (
              <>
                {editBody}
                <ValidationList rows={validation} />
                <Disclosure summary="Info">{infoBody}</Disclosure>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
