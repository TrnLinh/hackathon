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
  collectionId,
  person,
}: {
  collectionId: string;
  person: Person;
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
            <Button
              variant="destructive"
              onClick={() => actions.removeMember(collectionId, person.id)}
            >
              Remove member
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MembersPage({ collectionId }: { collectionId: string }) {
  const state = usePrototype();
  const collection = state.collections.find((c) => c.id === collectionId);
  if (!collection) return null;
  const isCreator = collection.creatorId === state.viewerId;
  const joinUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/app/join/${collection.joinCode}`
      : `/app/join/${collection.joinCode}`;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-8">
        <section aria-labelledby="members-heading" className="space-y-3">
          <h2
            id="members-heading"
            className="text-lg font-semibold tracking-tight"
          >
            Members ({collection.memberIds.length})
          </h2>
          <ul className="divide-y rounded-xl border bg-card">
            {collection.memberIds.map((id) => {
              const person = personById(state, id);
              const creator = id === collection.creatorId;
              return (
                <li
                  key={id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <PersonAvatar person={person} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {person.name}
                      {id === state.viewerId && (
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
                      collectionId={collectionId}
                      person={person}
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
            Join requests ({collection.pendingIds.length})
          </h2>
          {collection.pendingIds.length === 0 ? (
            <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              No one is waiting to join.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border bg-card">
              {collection.pendingIds.map((id) => {
                const person = personById(state, id);
                return (
                  <li
                    key={id}
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
                          onClick={() => actions.admitMember(collectionId, id)}
                        >
                          <UserPlus aria-hidden="true" /> Admit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => actions.declineJoin(collectionId, id)}
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
          <CopyField id="join-link" label="Join link" value={joinUrl} />
          <CopyField
            id="join-code"
            label="Join code"
            value={collection.joinCode}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Share it in person or through your group chat. No email is sent.
            Each person signs in and waits for{" "}
            {isCreator ? "you" : "the creator"} to admit them.
          </p>
        </div>
        <TrustNote>
          A join link alone grants no decryption rights. Members can only see a
          memory after everyone in it approves that exact version and audience.
          In this prototype, those protections are simulated.
        </TrustNote>
      </aside>
    </div>
  );
}
