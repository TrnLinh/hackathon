import { useState } from "react";
import { Check, Link2, UserMinus } from "lucide-react";
import { PersonAvatar } from "@/components/chorus/people";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Id } from "@convex/_generated/dataModel";
import type { ActionResult } from "@/features/data/backend";
import {
  toPerson,
  useCollection,
  useCollectionActions,
  useJoinRequests,
} from "@/features/data/collections";
import { useViewer } from "@/features/data/current-user";
import { actions, usePrototype } from "@/features/prototype/store";
import { personById } from "@/features/prototype/selectors";
import type { Person } from "@/features/prototype/types";

function CopyInvite({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
      <span role="status">{copied ? "Link copied" : "Copy invite link"}</span>
    </Button>
  );
}

function RemoveMemberDialog({
  person,
  onRemove,
}: {
  person: Person;
  onRemove: () => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${person.name}`}
        >
          <UserMinus aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {person.name}?</DialogTitle>
          <DialogDescription>
            Their own memories keep their current decisions. Anything they
            already received cannot be recalled.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" onClick={onRemove}>
              Remove
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type MemberEntry = { person: Person; role: "creator" | "contributor" };

/** Presentational people screen shared by the prototype and Convex adapters. */
function MembersView({
  viewerId,
  isCreator,
  members,
  requests,
  joinCode,
  devEnvelope,
  onAdmit,
  onDecline,
  onRemove,
}: {
  viewerId: string;
  isCreator: boolean;
  members: MemberEntry[];
  requests: Person[];
  joinCode: string | null;
  devEnvelope: boolean;
  onAdmit: (id: string) => Promise<ActionResult> | void;
  onDecline: (id: string) => Promise<ActionResult> | void;
  onRemove: (id: string) => Promise<ActionResult> | void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  // One action per person at a time; a double click must not send another.
  const run = (
    id: string,
    action: (id: string) => Promise<ActionResult> | void,
  ) => {
    if (busy.has(id)) return;
    setError(null);
    const pending = action(id);
    if (!pending) return;
    setBusy((s) => new Set(s).add(id));
    void pending.then((result) => {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      setError(result.ok ? null : result.reason);
    });
  };
  const joinUrl = joinCode
    ? typeof window !== "undefined"
      ? `${window.location.origin}/app/join/${joinCode}`
      : `/app/join/${joinCode}`
    : null;

  return (
    <div className="mx-auto max-w-2xl space-y-8 animate-in fade-in-0 slide-in-from-bottom-2">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">People</h2>
        {joinUrl ? <CopyInvite value={joinUrl} /> : null}
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {!joinUrl && (
        <p className="text-sm text-muted-foreground">
          Ask the creator for the invite link.
        </p>
      )}

      {requests.length > 0 && (
        <section aria-labelledby="requests-heading" className="space-y-3">
          <h3 id="requests-heading" className="text-base font-semibold">
            Wants to join
          </h3>
          <ul className="divide-y rounded-2xl bg-card shadow-soft ring-1 ring-border">
            {requests.map((person) => (
              <li
                key={person.id}
                className="flex flex-wrap items-center gap-3 p-3"
              >
                <PersonAvatar person={person} size="lg" />
                <p className="min-w-0 flex-1 font-medium">{person.name}</p>
                {isCreator ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => run(person.id, onAdmit)}
                      disabled={busy.has(person.id)}
                    >
                      Admit
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => run(person.id, onDecline)}
                      disabled={busy.has(person.id)}
                    >
                      Decline
                    </Button>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">Waiting</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="divide-y rounded-2xl bg-card shadow-soft ring-1 ring-border">
        {members.map(({ person, role }) => {
          const creator = role === "creator";
          return (
            <li key={person.id} className="flex items-center gap-3 p-3">
              <PersonAvatar person={person} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {person.name}
                  {person.id === viewerId && (
                    <span className="text-muted-foreground"> (you)</span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {creator ? "Creator" : "Contributor"}
                </p>
              </div>
              {isCreator && !creator && (
                <RemoveMemberDialog
                  person={person}
                  onRemove={() => run(person.id, onRemove)}
                />
              )}
            </li>
          );
        })}
      </ul>

      {devEnvelope && (
        <p className="text-center text-sm text-muted-foreground">
          Encryption is not connected yet. Zine details are stored unencrypted
          while we build.
        </p>
      )}
    </div>
  );
}

export function MembersPage({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  return state.collections.some((c) => c.id === collectionId) ? (
    <PrototypeMembersPage collectionId={collectionId} />
  ) : (
    <ConvexMembersPage collectionId={collectionId} />
  );
}

function PrototypeMembersPage({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  const collection = state.collections.find((c) => c.id === collectionId);
  if (!collection) return null;
  return (
    <MembersView
      viewerId={state.viewerId}
      isCreator={collection.creatorId === state.viewerId}
      members={collection.memberIds.map((id) => ({
        person: personById(state, id),
        role: id === collection.creatorId ? "creator" : "contributor",
      }))}
      requests={collection.pendingIds.map((id) => personById(state, id))}
      joinCode={collection.joinCode}
      devEnvelope={false}
      onAdmit={(id) => actions.admitMember(collectionId, id)}
      onDecline={(id) => actions.declineJoin(collectionId, id)}
      onRemove={(id) => actions.removeMember(collectionId, id)}
    />
  );
}

function ConvexMembersPage({ collectionId }: { collectionId: string }) {
  const collection = useCollection(collectionId);
  const viewer = useViewer();
  const member = collection?.access === "member" ? collection : null;
  const requests = useJoinRequests(
    member?.role === "creator" ? member.collectionId : null,
  );
  const actions = useCollectionActions();
  if (!member || !viewer) return null;
  const id = member.collectionId;
  return (
    <MembersView
      viewerId={viewer.userId}
      isCreator={member.role === "creator"}
      members={member.members.map((m) => ({
        person: toPerson(m),
        role: m.role,
      }))}
      requests={(requests ?? []).map(toPerson)}
      joinCode={member.joinCode}
      devEnvelope
      onAdmit={(userId) => actions.admitMember(id, userId as Id<"users">)}
      onDecline={(userId) => actions.declineJoin(id, userId as Id<"users">)}
      onRemove={(userId) => actions.removeMember(id, userId as Id<"users">)}
    />
  );
}
