import { createContext, useContext, type ReactNode } from "react";
import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  ChevronLeft,
  Images,
  LockOpen,
  MoreHorizontal,
  UsersRound,
} from "lucide-react";
import { PersonStack } from "@/components/chorus/people";
import { EmptyState } from "@/components/chorus/page-header";
import { StepProgress, type Step } from "@/components/chorus/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toPerson, useCollection } from "@/features/data/collections";
import type { Person } from "@/features/prototype/types";
import { usePrototype } from "@/features/prototype/store";
import {
  activeCandidate,
  collectionMemories,
  latestPlan,
  memoryStatus,
  personById,
} from "@/features/prototype/selectors";

type StepKey = "gather" | "approve" | "design" | "share";

// Zines created through Convex (CH-04) and prototype seed zines coexist while
// screens move to the backend one feature at a time. Child routes that still
// run on mock data wrap themselves in PrototypeOnly.
const SourceContext = createContext<"prototype" | "convex">("prototype");

/** Renders mock-data screens for prototype zines only. */
export function PrototypeOnly({ children }: { children: ReactNode }) {
  if (useContext(SourceContext) === "prototype") return children;
  return (
    <EmptyState
      icon={<Images className="size-5" aria-hidden="true" />}
      title="Not connected yet"
    >
      Sharing and history still run on demo data. Open a demo zine from Our
      zines to try them.
    </EmptyState>
  );
}

/** Interim CH-04 storage is the labelled dev envelope, not encryption. */
export function DevEnvelopeBadge() {
  return (
    <Badge
      variant="outline"
      title="Zine details are stored unencrypted until Tide encryption is connected."
    >
      <LockOpen aria-hidden="true" /> Not encrypted (dev)
    </Badge>
  );
}

function NotFound() {
  return (
    <EmptyState
      icon={<Images className="size-5" aria-hidden="true" />}
      title="Zine not found"
      action={
        <Button asChild variant="outline">
          <Link to="/collections">Back to our zines</Link>
        </Button>
      }
    >
      It may have been removed, or you are not in it.
    </EmptyState>
  );
}

function ZineHeader({
  collectionId,
  title,
  people,
  badge,
  showHistory,
}: {
  collectionId: string;
  title: string;
  people: Person[];
  badge?: ReactNode;
  showHistory: boolean;
}) {
  return (
    <header className="space-y-1">
      <Link
        to="/collections"
        className="inline-flex min-h-11 items-center gap-1 rounded-xl pr-3 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" /> Our zines
      </Link>
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <span className="shrink-0">
          <PersonStack people={people} max={2} />
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="More">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild className="min-h-11">
              <Link
                to="/collections/$collectionId/members"
                params={{ collectionId }}
              >
                People
              </Link>
            </DropdownMenuItem>
            {showHistory && (
              <DropdownMenuItem asChild className="min-h-11">
                <Link
                  to="/collections/$collectionId/history"
                  params={{ collectionId }}
                >
                  History
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {badge}
    </header>
  );
}

export function CollectionLayout({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  return state.collections.some((c) => c.id === collectionId) ? (
    <PrototypeCollectionLayout collectionId={collectionId} />
  ) : (
    <ConvexCollectionLayout collectionId={collectionId} />
  );
}

/** Backend zines: gathering and designing run on Convex; sharing is still demo-only. */
function ConvexSteps({ collectionId }: { collectionId: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onCompose = pathname.endsWith("/compose");
  const atRoot = /\/collections\/[^/]+\/?$/.test(pathname);
  if (!onCompose && !atRoot) return null;
  const steps: Step[] = [
    {
      key: "gather",
      label: "Gather",
      state: onCompose ? "done" : "current",
      to: "/collections/$collectionId",
      params: { collectionId },
    },
    {
      key: "design",
      label: "Design",
      state: onCompose ? "current" : "todo",
      to: "/collections/$collectionId/compose",
      params: { collectionId },
    },
  ];
  return (
    <nav aria-label="Zine steps">
      <StepProgress steps={steps} className="max-w-xs" />
    </nav>
  );
}

function ConvexCollectionLayout({ collectionId }: { collectionId: string }) {
  const collection = useCollection(collectionId);
  if (collection === undefined)
    return (
      <p role="status" className="py-10 text-sm text-muted-foreground">
        Opening the zine
      </p>
    );
  if (collection.access === "requested")
    return (
      <EmptyState
        icon={<UsersRound className="size-5" aria-hidden="true" />}
        title="Waiting to be let in"
      >
        You asked to join this zine. The creator has not let you in yet.
      </EmptyState>
    );
  if (collection.access === "none") return <NotFound />;
  return (
    <SourceContext.Provider value="convex">
      <div className="space-y-5">
        <ZineHeader
          collectionId={collectionId}
          title={collection.metadata.title}
          people={collection.members.map(toPerson)}
          badge={<DevEnvelopeBadge />}
          showHistory={false}
        />
        <ConvexSteps collectionId={collectionId} />
        <Outlet />
      </div>
    </SourceContext.Provider>
  );
}

function PrototypeCollectionLayout({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const collection = state.collections.find((c) => c.id === collectionId);
  if (!collection) return <NotFound />;
  const isMember = collection.memberIds.includes(state.viewerId);

  const statuses = collectionMemories(state, collectionId)
    .filter((m) => m.submitted)
    .map(memoryStatus);
  const hasReady = statuses.some(
    (s) => s === "available" || s === "manual-only",
  );
  const hasWaiting = statuses.includes("awaiting");
  const hasPlan = !!latestPlan(state, collectionId);
  const hasCandidate = !!activeCandidate(state, collectionId);

  // The step bar only helps on the two overview screens. Forms, detail pages
  // and the Share wizard carry their own progress, so hide it there.
  const showSteps =
    pathname.endsWith("/compose") || /\/collections\/[^/]+\/?$/.test(pathname);
  let current: StepKey | null = "gather";
  if (pathname.includes("/compose")) current = "design";
  else if (pathname.includes("/edition")) current = "share";
  else if (pathname.includes("/members") || pathname.includes("/history"))
    current = null;

  const stateOf = (key: StepKey, done: boolean): Step["state"] =>
    current === key ? "current" : done ? "done" : "todo";
  const steps: Step[] = [
    {
      key: "gather",
      label: "Gather",
      state: stateOf("gather", statuses.length > 0),
      to: "/collections/$collectionId",
      params: { collectionId },
    },
    {
      key: "approve",
      label: "Approve",
      state: stateOf("approve", hasReady && !hasWaiting),
      to: "/approvals",
    },
    {
      key: "design",
      label: "Design",
      state: stateOf("design", hasPlan),
      to: "/collections/$collectionId/compose",
      params: { collectionId },
    },
    {
      key: "share",
      label: "Share",
      state: stateOf("share", hasCandidate),
      to: "/collections/$collectionId/edition",
      params: { collectionId },
    },
  ];

  return (
    <div className="space-y-5">
      <ZineHeader
        collectionId={collectionId}
        title={collection.title}
        people={collection.memberIds.map((id) => personById(state, id))}
        showHistory
      />
      {isMember ? (
        <>
          {showSteps && (
            <nav aria-label="Zine steps">
              <StepProgress steps={steps} />
            </nav>
          )}
          <Outlet />
        </>
      ) : (
        <EmptyState
          icon={<UsersRound className="size-5" aria-hidden="true" />}
          title="You are not in this zine"
        >
          Ask the creator for the join link.
        </EmptyState>
      )}
    </div>
  );
}
