import { Link } from "@tanstack/react-router";
import { Clock3, DoorOpen, LinkIcon, UsersRound } from "lucide-react";
import { EmptyState, TrustNote } from "@/components/chorus/page-header";
import { PersonStack } from "@/components/chorus/people";
import { Button } from "@/components/ui/button";
import { actions, usePrototype } from "@/features/prototype/store";
import { personById } from "@/features/prototype/selectors";

export function JoinPage({ code }: { code: string }) {
  const state = usePrototype();
  const collection = state.collections.find(
    (c) => c.joinCode.toUpperCase() === code.toUpperCase(),
  );

  if (!collection)
    return (
      <EmptyState
        icon={<LinkIcon className="size-5" aria-hidden="true" />}
        title="This join link isn’t valid"
        action={
          <Button asChild variant="outline">
            <Link to="/collections">Go to your collections</Link>
          </Button>
        }
      >
        Check the code with the person who shared it. Links can be replaced when
        a creator rotates them.
      </EmptyState>
    );

  const creator = personById(state, collection.creatorId);
  const member = collection.memberIds.includes(state.viewerId);
  const waiting = collection.pendingIds.includes(state.viewerId);

  return (
    <div className="mx-auto max-w-lg space-y-6 py-6">
      <div className="rounded-2xl border bg-card p-6 text-center sm:p-8">
        <span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
          <DoorOpen className="size-5" aria-hidden="true" />
        </span>
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {creator.name} invited you to
        </p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight">
          {collection.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {collection.occasion}
        </p>
        <div className="mt-4 flex justify-center">
          <PersonStack
            people={collection.memberIds.map((id) => personById(state, id))}
            size="md"
          />
        </div>

        <div className="mt-6" role="status">
          {member ? (
            <div className="space-y-3">
              <p className="inline-flex items-center gap-2 text-sm">
                <UsersRound
                  className="size-4 text-primary"
                  aria-hidden="true"
                />
                You’re already a member.
              </p>
              <div>
                <Button asChild>
                  <Link
                    to="/collections/$collectionId"
                    params={{ collectionId: collection.id }}
                  >
                    Open the collection
                  </Link>
                </Button>
              </div>
            </div>
          ) : waiting ? (
            <p className="inline-flex items-center gap-2 text-sm">
              <Clock3
                className="size-4 text-[var(--status-awaiting)]"
                aria-hidden="true"
              />
              Request sent. Waiting for {creator.name.split(" ")[0]} to admit
              you.
            </p>
          ) : (
            <Button onClick={() => actions.requestJoin(collection.id)}>
              Ask to join
            </Button>
          )}
        </div>
      </div>
      <TrustNote>
        Joining makes you a member, but it doesn’t unlock anyone’s memories.
        Each memory is shared only after everyone in it approves. You decide the
        same for yours. In this prototype, sign-in is simulated by the viewer
        switcher.
      </TrustNote>
    </div>
  );
}
