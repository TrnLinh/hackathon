import { createContext, useContext, type ReactNode } from "react";
import { Link, Outlet } from "@tanstack/react-router";
import {
  BookOpenCheck,
  History,
  Images,
  LockOpen,
  PenTool,
  UsersRound,
} from "lucide-react";
import { PersonStack } from "@/components/chorus/people";
import { EmptyState } from "@/components/chorus/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toPerson, useCollection } from "@/features/data/collections";
import type { Person } from "@/features/prototype/types";
import { usePrototype } from "@/features/prototype/store";
import { personById } from "@/features/prototype/selectors";

const tabs = [
  {
    to: "/collections/$collectionId",
    label: "Memories",
    icon: Images,
    exact: true,
  },
  {
    to: "/collections/$collectionId/members",
    label: "Members",
    icon: UsersRound,
    exact: false,
  },
  {
    to: "/collections/$collectionId/compose",
    label: "Compose",
    icon: PenTool,
    exact: false,
  },
  {
    to: "/collections/$collectionId/edition",
    label: "Edition",
    icon: BookOpenCheck,
    exact: false,
  },
  {
    to: "/collections/$collectionId/history",
    label: "History",
    icon: History,
    exact: false,
  },
] as const;
type Tab = (typeof tabs)[number];

// Collections created through Convex (CH-04) and prototype seed collections
// coexist while screens move to the backend one feature at a time. Child
// routes that still run on mock data wrap themselves in PrototypeOnly.
const SourceContext = createContext<"prototype" | "convex">("prototype");

/** Renders mock-data screens for prototype collections only. */
export function PrototypeOnly({ children }: { children: ReactNode }) {
  if (useContext(SourceContext) === "prototype") return children;
  return (
    <EmptyState
      icon={<Images className="size-5" aria-hidden="true" />}
      title="Not connected to the backend yet"
    >
      Editions and history still run on prototype data. Open a prototype demo
      collection from Your collections to try them.
    </EmptyState>
  );
}

function NotFound() {
  return (
    <EmptyState
      icon={<Images className="size-5" aria-hidden="true" />}
      title="Collection not found"
      action={
        <Button asChild variant="outline">
          <Link to="/collections">Back to collections</Link>
        </Button>
      }
    >
      It may have been removed, or you are not a member.
    </EmptyState>
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

function ConvexCollectionLayout({ collectionId }: { collectionId: string }) {
  const collection = useCollection(collectionId);
  if (collection === undefined)
    return (
      <p role="status" className="py-10 text-sm text-muted-foreground">
        Opening the collection…
      </p>
    );
  if (collection.access === "requested")
    return (
      <EmptyState
        icon={<UsersRound className="size-5" aria-hidden="true" />}
        title="Waiting for admission"
      >
        You asked to join this collection. The creator hasn’t admitted you yet.
      </EmptyState>
    );
  if (collection.access === "none") return <NotFound />;
  return (
    <SourceContext.Provider value="convex">
      <div className="space-y-6">
        <CollectionHeader
          title={collection.metadata.title}
          occasion={collection.metadata.occasion}
          people={collection.members.map(toPerson)}
          badge={<DevEnvelopeBadge />}
        />
        <CollectionTabs
          collectionId={collectionId}
          tabs={tabs.filter(
            (t) =>
              t.label === "Memories" ||
              t.label === "Members" ||
              t.label === "Compose",
          )}
        />
        <Outlet />
      </div>
    </SourceContext.Provider>
  );
}

/** Interim CH-04 storage is the labelled dev envelope, not encryption. */
export function DevEnvelopeBadge() {
  return (
    <Badge
      variant="outline"
      title="Collection details are stored unencrypted until Tide encryption is connected."
    >
      <LockOpen aria-hidden="true" /> Not encrypted (dev)
    </Badge>
  );
}

function CollectionHeader({
  title,
  occasion,
  people,
  badge,
}: {
  title: string;
  occasion: string;
  people: Person[];
  badge?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <Link
          to="/collections"
          className="text-xs font-medium tracking-widest text-muted-foreground uppercase hover:text-foreground"
        >
          Collections /
        </Link>
        <h1 className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {occasion}
          {badge}
        </p>
      </div>
      <PersonStack people={people} size="md" />
    </div>
  );
}

function CollectionTabs({
  collectionId,
  tabs,
}: {
  collectionId: string;
  tabs: readonly Tab[];
}) {
  return (
    <nav
      aria-label="Collection"
      className="-mx-1 flex gap-1 overflow-x-auto border-b px-1"
    >
      {tabs.map(({ to, label, icon: Icon, exact }) => (
        <Link
          key={to}
          to={to}
          params={{ collectionId }}
          activeOptions={{ exact }}
          activeProps={{
            className: "border-primary text-foreground",
            "aria-current": "page",
          }}
          inactiveProps={{
            className:
              "border-transparent text-muted-foreground hover:text-foreground",
          }}
          className="-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors"
        >
          <Icon className="size-4" aria-hidden="true" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function PrototypeCollectionLayout({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  const collection = state.collections.find((c) => c.id === collectionId);
  if (!collection) return <NotFound />;
  const isMember = collection.memberIds.includes(state.viewerId);
  return (
    <div className="space-y-6">
      <CollectionHeader
        title={collection.title}
        occasion={collection.occasion}
        people={collection.memberIds.map((id) => personById(state, id))}
      />
      {isMember ? (
        <>
          <CollectionTabs collectionId={collectionId} tabs={tabs} />
          <Outlet />
        </>
      ) : (
        <EmptyState
          icon={<UsersRound className="size-5" aria-hidden="true" />}
          title="You are not a member of this collection"
        >
          Ask the creator for the join link. Joining never grants access to
          memories by itself; each memory still needs its contributors’
          permission.
        </EmptyState>
      )}
    </div>
  );
}
