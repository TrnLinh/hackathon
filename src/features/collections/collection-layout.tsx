import { Link, Outlet } from "@tanstack/react-router";
import {
  BookOpenCheck,
  History,
  Images,
  PenTool,
  UsersRound,
} from "lucide-react";
import { PersonStack } from "@/components/chorus/people";
import { EmptyState } from "@/components/chorus/page-header";
import { Button } from "@/components/ui/button";
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

export function CollectionLayout({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  const collection = state.collections.find((c) => c.id === collectionId);
  if (!collection)
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
  const isMember = collection.memberIds.includes(state.viewerId);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Link
            to="/collections"
            className="text-xs font-medium tracking-widest text-muted-foreground uppercase hover:text-foreground"
          >
            Collections /
          </Link>
          <h1 className="mt-1 font-serif text-3xl tracking-tight sm:text-4xl">
            {collection.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {collection.occasion}
          </p>
        </div>
        <PersonStack
          people={collection.memberIds.map((id) => personById(state, id))}
          size="md"
        />
      </div>
      {isMember ? (
        <>
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
