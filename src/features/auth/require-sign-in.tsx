"use client";

import { useConvexAuth, useMutation } from "convex/react";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { useAuthConfiguration } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { describeError } from "@/features/data/backend";
import { useViewer } from "@/features/data/current-user";
import { useTideSession } from "./auth-provider";
import { rememberReturnPath } from "./return-path";

/** Waits for users.ensureCurrent so screens can rely on a registry row. */
function RegisteredGate({ children }: { children: ReactNode }) {
  const viewer = useViewer();
  const ensure = useMutation(api.users.ensureCurrent);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (viewer !== null) return;
    const timer = window.setTimeout(() => setSlow(true), 8_000);
    return () => window.clearTimeout(timer);
  }, [viewer]);
  if (viewer) return children;
  return (
    <div className="space-y-3 py-10">
      <p role="status" className="text-sm text-muted-foreground">
        {viewer === undefined
          ? "Verifying your session…"
          : "Setting up your account…"}
      </p>
      {slow && viewer === null && (
        <Button
          variant="outline"
          onClick={() => {
            setError(null);
            void ensure({}).catch((e: unknown) => setError(describeError(e)));
          }}
        >
          Try again
        </Button>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
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
              : (rememberReturnPath(), session.login()))
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
