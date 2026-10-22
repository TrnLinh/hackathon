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
import { CollectionsPage } from "@/features/collections/collections-page";
import { OverviewPage } from "@/features/overview/overview-page";
import { SettingsPage } from "@/features/settings/settings-page";
import { createWorkspaceHistory } from "@/router/history";
import { RequireSignIn } from "@/features/auth/require-sign-in";

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
  component: () => (
    <RequireSignIn>
      <CollectionsPage />
    </RequireSignIn>
  ),
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});
const routeTree = rootRoute.addChildren([
  overviewRoute,
  collectionsRoute,
  settingsRoute,
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
