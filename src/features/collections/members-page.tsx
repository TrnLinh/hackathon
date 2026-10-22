import { useState } from "react";
import { Check, Copy, UserMinus, UserPlus, X } from "lucide-react";
import { TrustNote } from "@/components/chorus/page-header";
import { PersonAvatar } from "@/components/chorus/people";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function CopyField({
  id,
  label,
  value,
}: {
  id: string;
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input id={id} value={value} readOnly className="font-mono text-xs" />
        <Button
          variant="outline"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1500);
            });
          }}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
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
        <Button variant="ghost" size="sm">
          <UserMinus aria-hidden="true" /> Remove
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {person.name}?</DialogTitle>
          <DialogDescription>
            Removal stops new application access to this collection for{" "}
            {person.name.split(" ")[0]}.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>
            Audiences that contributors already approved do not change silently.
            Any wider or narrower audience needs a new request.
          </li>
          <li>Previews or files they already received cannot be recalled.</li>
          <li>
            Their own memories keep their current decisions. They can still
            withdraw them.
          </li>
        </ul>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button variant="destructive" onClick={onRemove}>
              Remove member
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type MemberEntry = { person: Person; role: "creator" | "contributor" };

/** Presentational members screen shared by the prototype and Convex adapters. */
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
  const run = (action: Promise<ActionResult> | void) => {
    setError(null);
    void action?.then((result) => setError(result.ok ? null : result.reason));
  };
  const joinUrl = joinCode
    ? typeof window !== "undefined"
      ? `${window.location.origin}/app/join/${joinCode}`
      : `/app/join/${joinCode}`
    : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-8">
        <section aria-labelledby="members-heading" className="space-y-3">
          <h2
            id="members-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Members ({members.length})
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {members.map(({ person, role }) => {
              const creator = role === "creator";
              return (
                <li
                  key={person.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <PersonAvatar person={person} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {person.name}
                      {person.id === viewerId && (
                        <span className="text-muted-foreground"> (you)</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {creator
                        ? "Arranges the collection and freezes editions"
                        : "Adds memories and decides on their use"}
                    </p>
                  </div>
                  <Badge variant={creator ? "default" : "secondary"}>
                    {creator ? "Creator" : "Contributor"}
                  </Badge>
                  {isCreator && !creator && (
                    <RemoveMemberDialog
                      person={person}
                      onRemove={() => run(onRemove(person.id))}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="requests-heading" className="space-y-3">
          <h2
            id="requests-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Join requests ({requests.length})
          </h2>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {requests.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No one is waiting to join.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {requests.map((person) => {
                return (
                  <li
                    key={person.id}
                    className="flex flex-wrap items-center gap-3 px-4 py-3"
                  >
                    <PersonAvatar person={person} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{person.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Signed in and opened the join link
                      </p>
                    </div>
                    {isCreator ? (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => run(onAdmit(person.id))}
                        >
                          <UserPlus aria-hidden="true" /> Admit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => run(onDecline(person.id))}
                        >
                          <X aria-hidden="true" /> Decline
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="outline">Waiting for the creator</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-4">
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <h2 className="text-sm font-semibold">Invite contributors</h2>
          {joinCode && joinUrl ? (
            <>
              <CopyField id="join-link" label="Join link" value={joinUrl} />
              <CopyField id="join-code" label="Join code" value={joinCode} />
            </>
          ) : null}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {joinCode
              ? "Share it in person or through your group chat. No email is sent. "
              : "Ask the creator for the join link. "}
            Each person signs in and waits for{" "}
            {isCreator ? "you" : "the creator"} to admit them.
          </p>
        </div>
        <TrustNote>
          A join link alone grants no decryption rights. Members can only see a
          memory after everyone in it approves that exact version and audience.
          {devEnvelope
            ? " Encryption isn’t connected yet: this collection’s details are stored unencrypted for development."
            : " In this prototype, those protections are simulated."}
        </TrustNote>
      </aside>
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
