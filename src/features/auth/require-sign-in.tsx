"use client";

import { useConvexAuth } from "convex/react";
import type { ReactNode } from "react";
import { useAuthConfiguration } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { useViewer } from "@/features/data/current-user";
import { useTideSession } from "./auth-provider";

/** Waits for users.ensureCurrent so screens can rely on a registry row. */
function RegisteredGate({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  if (viewer) return children;
  return (
    <p role="status" className="py-10 text-sm text-muted-foreground">
      Setting up your account…
    </p>
  );
}

function SessionGate({ children }: { children: ReactNode }) {
  const session = useTideSession();
  const convex = useConvexAuth();
  if (session.phase === "authenticated" && convex.isAuthenticated)
    return <RegisteredGate>{children}</RegisteredGate>;
  const loading =
    session.phase === "loading" ||
    (session.phase === "authenticated" && convex.isLoading);
  return (
    <div className="space-y-4 py-10">
      <h1 className="font-serif text-3xl">Your memories start with you.</h1>
      <p role="status" className="text-sm text-muted-foreground">
        {session.message ??
          (loading
            ? "Verifying your session…"
            : "Sign in to open your collections.")}
      </p>
      {!loading && (
        <Button
          onClick={() =>
            void (session.phase === "authenticated"
              ? session.logout()
              : session.login())
          }
        >
          {session.phase === "authenticated"
            ? "Sign out and try again"
            : "Sign in"}
        </Button>
      )}
    </div>
  );
}

export function RequireSignIn({ children }: { children: ReactNode }) {
  const { configured, error } = useAuthConfiguration();
  if (!configured)
    return (
      <p role="status" className="py-10 text-sm text-muted-foreground">
        {error ??
          "Sign-in is not configured. Open Project setup to connect your workspace."}
      </p>
    );
  return <SessionGate>{children}</SessionGate>;
}
