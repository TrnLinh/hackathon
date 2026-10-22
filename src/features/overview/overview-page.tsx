import { Link } from "@tanstack/react-router";
import { ArrowRight, BookHeart, ChevronRight } from "lucide-react";
import { EmptyState } from "@/components/chorus/page-header";
import { MemoryThumb } from "@/components/chorus/memory-thumb";
import { StepProgress, type Step } from "@/components/chorus/primitives";
import { Button } from "@/components/ui/button";
import { usePrototype } from "@/features/prototype/store";
import {
  activeCandidate,
  candidateProgress,
  collectionMemories,
  firstName,
  inboxFor,
  latestPlan,
  memoryStatus,
  personById,
} from "@/features/prototype/selectors";

export function OverviewPage() {
  const state = usePrototype();
  const inbox = inboxFor(state, state.viewerId);
  const collection =
    state.collections.find((c) => c.id === "c-first-year") ??
    state.collections[0];

  if (!collection) {
    return (
      <div className="mx-auto max-w-xl animate-in py-8 fade-in-0 slide-in-from-bottom-2">
        <EmptyState
          icon={<BookHeart className="size-7" aria-hidden="true" />}
          title="No zines yet"
          action={
            <Button asChild size="lg">
              <Link to="/collections">Start a zine</Link>
            </Button>
          }
        >
          Start one and invite your friends.
        </EmptyState>
      </div>
    );
  }

  const id = collection.id;
  const memories = collectionMemories(state, id);
  const cover = memories.filter((m) => m.submitted).slice(0, 4);
  const plan = latestPlan(state, id);
  const candidate = activeCandidate(state, id);
  const progress = candidate ? candidateProgress(candidate) : null;
  const waitingOnOthers = memories.some((m) => memoryStatus(m) === "awaiting");

  const status =
    inbox.length > 0
      ? `${inbox.length} waiting for you`
      : candidate?.status === "issued"
        ? "Ready to share"
        : candidate && progress
          ? `${progress.approved} of ${progress.total} approved`
          : waitingOnOthers
            ? "Waiting on friends"
            : memories.length === 0
              ? "No memories yet"
              : `${memories.length} memories gathered`;

  const gatherDone = memories.length > 0;
  const approveDone = gatherDone && !waitingOnOthers && inbox.length === 0;
  const designDone = !!plan;
  const shareDone = candidate?.status === "issued";
  const done = [gatherDone, approveDone, designDone, shareDone];
  const currentIndex = done.findIndex((d) => !d);
  const labels = ["Gather", "Approve", "Design", "Share"];
  const steps: Step[] = labels.map((label, i) => ({
    key: label,
    label,
    state: done[i] ? "done" : i === currentIndex ? "current" : "todo",
  }));

  let primary: React.ReactNode;
  if (inbox.length > 0) {
    primary = (
      <Link to="/approvals">
        Review {inbox.length} waiting <ArrowRight aria-hidden="true" />
      </Link>
    );
  } else if (!plan) {
    primary = (
      <Link
        to="/collections/$collectionId/compose"
        params={{ collectionId: id }}
      >
        Design your zine <ArrowRight aria-hidden="true" />
      </Link>
    );
  } else if (candidate) {
    primary = (
      <Link
        to="/collections/$collectionId/edition"
        params={{ collectionId: id }}
      >
        Share <ArrowRight aria-hidden="true" />
      </Link>
    );
  } else {
    primary = (
      <Link
        to="/collections/$collectionId/memories/new"
        params={{ collectionId: id }}
      >
        Add a memory <ArrowRight aria-hidden="true" />
      </Link>
    );
  }

  const viewer = personById(state, state.viewerId);
  const S = (i: number) => ({ "--i": i }) as React.CSSProperties;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <section
        aria-labelledby="hero-title"
        className="rise relative overflow-hidden rounded-[2.25rem] bg-primary shadow-lift"
        style={S(0)}
      >
        <Link
          to="/collections/$collectionId"
          params={{ collectionId: id }}
          aria-label={`Open ${collection.title}`}
          className="press block"
        >
          <div className="grid aspect-4/5 grid-cols-6 grid-rows-3 gap-1 sm:aspect-video sm:grid-rows-2">
            {cover.length === 0 ? (
              <div className="col-span-6 row-span-3 grid place-items-center bg-lime text-lime-ink sm:row-span-2">
                <BookHeart className="size-14" aria-hidden="true" />
              </div>
            ) : (
              cover.map((m, i) => (
                <MemoryThumb
                  key={m.id}
                  memory={m}
                  className={
                    cover.length === 1
                      ? "col-span-6 row-span-3 sm:row-span-2"
                      : i === 0
                        ? "col-span-4 row-span-3 sm:row-span-2"
                        : cover.length === 2
                          ? "col-span-2 row-span-3 sm:row-span-2"
                          : "col-span-2 row-span-1"
                  }
                />
              ))
            )}
          </div>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/80 via-black/40 to-transparent"
          />
        </Link>
        <span className="pop absolute top-4 left-4 inline-flex -rotate-2 items-center rounded-full bg-lime px-3.5 py-1.5 text-sm font-semibold text-lime-ink shadow-soft">
          {status}
        </span>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-5 text-white sm:p-8 sm:right-[34%]">
          <p className="text-base font-medium text-white/80">
            Hey {firstName(viewer)}.
          </p>
          <h1
            id="hero-title"
            className="mt-1 text-4xl leading-[1.02] font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            {collection.title}
          </h1>
        </div>
      </section>

      <div className="rise space-y-5 px-1" style={S(1)}>
        <StepProgress steps={steps} />
        <Button
          asChild
          variant="highlight"
          size="lg"
          className="h-14 w-full text-lg sm:w-auto sm:px-10"
        >
          {primary}
        </Button>
      </div>

      {inbox.length > 0 && (
        <section aria-labelledby="waiting-title" className="space-y-3">
          <h2
            id="waiting-title"
            className="rise px-1 text-2xl font-semibold tracking-tight"
            style={S(2)}
          >
            Waiting for you
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {inbox.slice(0, 3).map((m, i) => (
              <li key={m.id} className="rise" style={S(i + 3)}>
                <Link
                  to="/approvals/$memoryId"
                  params={{ memoryId: m.id }}
                  className="press group relative block overflow-hidden rounded-3xl bg-card shadow-soft ring-1 ring-border"
                >
                  <MemoryThumb memory={m} className="aspect-4/3 w-full" />
                  <div className="flex items-center gap-3 p-4">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-semibold">
                        {m.title}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        From {personById(state, m.uploaderId).name}
                      </span>
                    </span>
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-lime text-lime-ink">
                      <ChevronRight className="size-5" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="pb-2 text-center text-sm text-muted-foreground">
        Demo data. Everything here is simulated.{" "}
        <Link
          to="/settings"
          className="inline-flex min-h-11 items-center px-1 underline underline-offset-4 hover:text-foreground"
        >
          Settings
        </Link>
      </p>
    </div>
  );
}
