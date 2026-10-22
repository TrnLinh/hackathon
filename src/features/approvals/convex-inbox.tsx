import { Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { EmptyState } from "@/components/chorus/page-header";
import { MemoryStatusBadge } from "@/components/chorus/status";
import { Button } from "@/components/ui/button";
import { useAuthConfiguration } from "@/components/providers";
import {
  BackendOnly,
  formatTime,
  QueryBoundary,
} from "@/features/data/backend";
import { useInbox } from "@/features/data/consent";
import { consentStatus, useMemory } from "@/features/data/memories";
import {
  ConvexMemoryDetail,
  LocalConsentNote,
} from "@/features/memories/convex-memories";

// CH-07 inbox for collections on Convex: current requests that include you.
// Decisions are recorded locally and unverified until Tide is connected.

function ConvexRequests() {
  const rows = useInbox();
  if (rows === undefined)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading requests…
      </p>
    );
  const waiting = rows.filter((r) => r.permission.myAction === null);
  const decided = rows.filter((r) => r.permission.myAction !== null);
  return (
    <section aria-labelledby="backend-requests" className="space-y-3">
      <h2
        id="backend-requests"
        className="text-lg font-semibold tracking-tight"
      >
        Requests in your collections{" "}
        <span className="font-normal text-muted-foreground">
          ({waiting.length} waiting)
        </span>
      </h2>
      {rows.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-5" aria-hidden="true" />}
          title="Nothing needs your decision"
        >
          When someone submits a memory that includes you, it appears here.
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {[...waiting, ...decided].map((r) => (
            <li
              key={r.permission.permissionId}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {r.uploaderName ?? "A member"} asked for your approval
                </p>
                <p className="text-xs text-muted-foreground">
                  Requested {formatTime(r.permission.requestedAt)}
                  {r.permission.myAction
                    ? " · you’ve decided"
                    : " · waiting for you"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <MemoryStatusBadge status={consentStatus(r.permission)} />
                <Button
                  size="sm"
                  variant={r.permission.myAction ? "outline" : "default"}
                  asChild
                >
                  <Link
                    to="/collections/$collectionId/memories/$memoryId"
                    params={{
                      collectionId: r.collectionId,
                      memoryId: r.memoryId,
                    }}
                  >
                    {r.permission.myAction ? "Review again" : "Review"}
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <LocalConsentNote />
    </section>
  );
}

export function ConvexInboxSection() {
  const { configured } = useAuthConfiguration();
  if (!configured) return null;
  return (
    <BackendOnly>
      <QueryBoundary
        fallback={
          <p role="status" className="text-sm text-muted-foreground">
            Requests can’t be loaded right now.
          </p>
        }
      >
        <ConvexRequests />
      </QueryBoundary>
    </BackendOnly>
  );
}

/** Waiting count for the navigation badge; null when unavailable. */
export function useConvexWaitingCount() {
  const rows = useInbox();
  return rows?.filter((r) => r.permission.myAction === null).length ?? null;
}

/** A review link for a memory on Convex opens its collection page. */
export function ConvexApprovalReview({ memoryId }: { memoryId: string }) {
  const memory = useMemory(memoryId);
  if (memory === undefined)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Opening the request…
      </p>
    );
  if (!memory)
    return (
      <EmptyState
        icon={<Inbox className="size-5" aria-hidden="true" />}
        title="This request isn’t available"
        action={
          <Button asChild variant="outline">
            <Link to="/approvals">Back to approvals</Link>
          </Button>
        }
      >
        It may have been replaced by a new version, or it doesn’t include you.
      </EmptyState>
    );
  return (
    <ConvexMemoryDetail
      collectionId={memory.collectionId}
      memoryId={memoryId}
    />
  );
}
