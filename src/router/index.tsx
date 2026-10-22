"use client";

import { useState } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  RouterProvider,
} from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { ApprovalReview } from "@/features/approvals/approval-review";
import { ApprovalsInbox } from "@/features/approvals/approvals-inbox";
import {
  CollectionLayout,
  PrototypeOnly,
} from "@/features/collections/collection-layout";
import { CollectionsPage } from "@/features/collections/collections-page";
import { MembersPage } from "@/features/collections/members-page";
import { MemoriesBoard } from "@/features/collections/memories-board";
import { ComposerPage } from "@/features/composer/composer-page";
import { EditionPage } from "@/features/edition/edition-page";
import { HistoryPage } from "@/features/history/history-page";
import { JoinPage } from "@/features/join/join-page";
import { RequireSignIn } from "@/features/auth/require-sign-in";
import { MemoryDetail } from "@/features/memories/memory-detail";
import { MemoryEditor } from "@/features/memories/memory-editor";
import { OverviewPage } from "@/features/overview/overview-page";
import { ProcessorsPage } from "@/features/processors/processors-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { VerifyPage } from "@/features/verify/verify-page";
import { createWorkspaceHistory } from "@/router/history";
import { PolicyProofPage } from "@/features/policy-proof/proof-page";

// Routes on Convex (collections, members, join) require sign-in. Other routes
// still render mock data from features/prototype; collection child routes on
// mock data are wrapped in PrototypeOnly until they move to Convex.

function NotFoundPage() {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-sm flex-col items-center justify-center text-center">
      <span className="pop mb-6 grid size-16 -rotate-3 place-items-center rounded-3xl bg-lime text-lime-ink">
        <Compass className="size-8" aria-hidden="true" />
      </span>
      <h1 className="rise text-4xl font-semibold tracking-tight text-balance">
        We couldn’t find that page
      </h1>
      <p className="mt-2 text-base text-muted-foreground">
        It may have moved, or the link is wrong.
      </p>
      <Button
        asChild
        variant="highlight"
        size="lg"
        className="mt-6 h-14 px-10 text-lg"
      >
        <Link to="/">Go home</Link>
      </Button>
    </div>
  );
}

const rootRoute = createRootRoute({
  component: AppShell,
  notFoundComponent: NotFoundPage,
});
const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: OverviewPage,
});
const collectionsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/collections",
  component: function CollectionsRoute() {
    return (
      <RequireSignIn>
        <CollectionsPage />
      </RequireSignIn>
    );
  },
});
const collectionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/collections/$collectionId",
  component: function CollectionRoute() {
    const { collectionId } = collectionRoute.useParams();
    return (
      <RequireSignIn>
        <CollectionLayout collectionId={collectionId} />
      </RequireSignIn>
    );
  },
});
const memoriesRoute = createRoute({
  getParentRoute: () => collectionRoute,
  path: "/",
  component: function MemoriesRoute() {
    const { collectionId } = collectionRoute.useParams();
    return <MemoriesBoard collectionId={collectionId} />;
  },
});
const membersRoute = createRoute({
  getParentRoute: () => collectionRoute,
  path: "/members",
  component: function MembersRoute() {
    const { collectionId } = collectionRoute.useParams();
    return <MembersPage collectionId={collectionId} />;
  },
});
const newMemoryRoute = createRoute({
  getParentRoute: () => collectionRoute,
  path: "/memories/new",
  component: function NewMemoryRoute() {
    const { collectionId } = collectionRoute.useParams();
    return <MemoryEditor collectionId={collectionId} />;
  },
});
const memoryRoute = createRoute({
  getParentRoute: () => collectionRoute,
  path: "/memories/$memoryId",
  component: function MemoryRoute() {
    const { collectionId, memoryId } = memoryRoute.useParams();
    return <MemoryDetail collectionId={collectionId} memoryId={memoryId} />;
  },
});
const composeRoute = createRoute({
  getParentRoute: () => collectionRoute,
  path: "/compose",
  component: function ComposeRoute() {
    const { collectionId } = collectionRoute.useParams();
    return <ComposerPage collectionId={collectionId} />;
  },
});
const editionRoute = createRoute({
  getParentRoute: () => collectionRoute,
  path: "/edition",
  component: function EditionRoute() {
    const { collectionId } = collectionRoute.useParams();
    return (
      <PrototypeOnly>
        <EditionPage collectionId={collectionId} />
      </PrototypeOnly>
    );
  },
});
const historyRoute = createRoute({
  getParentRoute: () => collectionRoute,
  path: "/history",
  component: function HistoryRoute() {
    const { collectionId } = collectionRoute.useParams();
    return (
      <PrototypeOnly>
        <HistoryPage collectionId={collectionId} />
      </PrototypeOnly>
    );
  },
});
const joinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/join/$code",
  component: function JoinRoute() {
    const { code } = joinRoute.useParams();
    return (
      <RequireSignIn>
        <JoinPage code={code} />
      </RequireSignIn>
    );
  },
});
const approvalsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/approvals",
  component: ApprovalsInbox,
});
const approvalRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/approvals/$memoryId",
  component: function ApprovalRoute() {
    const { memoryId } = approvalRoute.useParams();
    return <ApprovalReview memoryId={memoryId} />;
  },
});
const processorsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/processors",
  component: ProcessorsPage,
});
const verifyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/verify",
  component: VerifyPage,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});
const routeTree = rootRoute.addChildren([
  overviewRoute,
  collectionsRoute,
  collectionRoute.addChildren([
    memoriesRoute,
    membersRoute,
    newMemoryRoute,
    memoryRoute,
    composeRoute,
    editionRoute,
    historyRoute,
  ]),
  joinRoute,
  approvalsRoute,
  approvalRoute,
  processorsRoute,
  verifyRoute,
  settingsRoute,
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/policy-proof",
    component: PolicyProofPage,
  }),
]);

export function createAppRouter() {
  return createRouter({
    routeTree,
    history: createWorkspaceHistory(),
    basepath: "/app",
    defaultPreload: "intent",
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

export function WorkspaceRouter() {
  const [router] = useState(createAppRouter);
  return <RouterProvider router={router} />;
}
