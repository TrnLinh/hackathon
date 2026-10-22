"use client";

import { useState } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  RouterProvider,
} from "@tanstack/react-router";
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
    <div className="py-12">
      <h1 className="font-serif text-4xl">This page is still unwritten.</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        There isn’t a workspace page at this address.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Back to overview</Link>
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
    return (
      <PrototypeOnly>
        <ComposerPage collectionId={collectionId} />
      </PrototypeOnly>
    );
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
