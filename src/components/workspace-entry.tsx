"use client";

import dynamic from "next/dynamic";

const WorkspaceRouter = dynamic(
  () => import("@/router").then((module) => module.WorkspaceRouter),
  {
    ssr: false,
    loading: () => (
      <main className="grid min-h-screen place-items-center">
        <p role="status" className="text-sm text-muted-foreground">
          Opening your workspace…
        </p>
      </main>
    ),
  },
);

export function WorkspaceEntry() {
  return <WorkspaceRouter />;
}
