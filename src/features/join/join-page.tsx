import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Clock3, DoorOpen, LinkIcon, UsersRound } from "lucide-react";
import { EmptyState, TrustNote } from "@/components/chorus/page-header";
import { Button } from "@/components/ui/button";
import {
  useCollectionActions,
  useJoinPreview,
} from "@/features/data/collections";

// CH-04: a join code lets a signed-in person ask to join. Until admitted they
// see who invited them, never the collection's private details.

export function JoinPage({ code }: { code: string }) {
  const preview = useJoinPreview(code);
  const { requestJoin } = useCollectionActions();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (preview === undefined)
    return (
      <p role="status" className="py-10 text-sm text-muted-foreground">
        Checking the join link…
      </p>
    );
  if (preview === null)
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

  const creator = preview.creatorName ?? "The creator";
  const firstName = creator.split(" ")[0];

  async function ask() {
    setSending(true);
    const result = await requestJoin(code);
    setSending(false);
    setError(result.ok ? null : result.reason);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 py-6">
      <div className="rounded-2xl border bg-card p-6 text-center sm:p-8">
        <span className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
          <DoorOpen className="size-5" aria-hidden="true" />
        </span>
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {creator} invited you to
        </p>
        <h1 className="mt-2 font-serif text-3xl tracking-tight">
          a shared collection
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {preview.memberCount}{" "}
          {preview.memberCount === 1 ? "member" : "members"} so far. You’ll see
          its title once you’re admitted.
        </p>

        <div className="mt-6 space-y-3" role="status">
          {preview.viewerStatus === "active" ? (
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
                    params={{ collectionId: preview.collectionId }}
                  >
                    Open the collection
                  </Link>
                </Button>
              </div>
            </div>
          ) : preview.viewerStatus === "requested" ? (
            <p className="inline-flex items-center gap-2 text-sm">
              <Clock3
                className="size-4 text-[var(--status-awaiting)]"
                aria-hidden="true"
              />
              Request sent. Waiting for {firstName} to admit you.
            </p>
          ) : (
            <>
              {preview.viewerStatus !== "none" && (
                <p className="text-sm text-muted-foreground">
                  {preview.viewerStatus === "declined"
                    ? `${firstName} declined your last request.`
                    : `${firstName} removed you from this collection.`}{" "}
                  You can ask again.
                </p>
              )}
              <Button disabled={sending} onClick={() => void ask()}>
                {sending ? "Sending…" : "Ask to join"}
              </Button>
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
      <TrustNote>
        Joining makes you a member, but it doesn’t unlock anyone’s memories.
        Each memory is shared only after everyone in it approves. You decide the
        same for yours.
      </TrustNote>
    </div>
  );
}
