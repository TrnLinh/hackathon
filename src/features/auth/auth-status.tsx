"use client";

import { useState } from "react";
import { ConvexHttpClient } from "convex/browser";
import { useConvex, useConvexAuth, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useAuthConfiguration } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { useTideSession } from "./auth-provider";
import { rememberReturnPath } from "./return-path";

function SessionControls() {
  const session = useTideSession();
  const convex = useConvexAuth();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span role="status" className="text-xs text-muted-foreground">
        {session.phase === "authenticated"
          ? convex.isAuthenticated
            ? "Signed in"
            : "Verifying your session…"
          : session.phase === "loading"
            ? "Checking your session…"
            : "Signed out"}
      </span>
      {session.phase === "authenticated" ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => void session.logout()}
        >
          Sign out
        </Button>
      ) : (
        <Button
          size="sm"
          disabled={session.phase === "loading"}
          onClick={() => {
            rememberReturnPath();
            void session.login();
          }}
        >
          Sign in
        </Button>
      )}
    </div>
  );
}

export function AccountControls() {
  const { configured } = useAuthConfiguration();
  return configured ? <SessionControls /> : null;
}

function RenewalCheck() {
  const session = useTideSession();
  const backend = useConvex();
  const [checking, setChecking] = useState(false);
  const [verified, setVerified] = useState(false);

  async function check() {
    setChecking(true);
    setVerified(false);
    try {
      setVerified(
        await session.verifyRenewal(async (token) => {
          const client = new ConvexHttpClient(backend.url, { logger: false });
          client.setAuth(token);
          try {
            return await client.query(api.identity.current, {});
          } finally {
            client.clearAuth();
          }
        }),
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="outline" disabled={checking} onClick={check}>
        {checking ? "Checking renewal…" : "Verify session renewal"}
      </Button>
      {verified && (
        <p role="status">
          Session renewed; Convex confirmed the same identity.
        </p>
      )}
    </div>
  );
}

function VerifiedIdentity() {
  const session = useTideSession();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const signedIn = session.phase === "authenticated" && isAuthenticated;
  const identity = useQuery(api.identity.current, signedIn ? {} : "skip");
  return (
    <div className="space-y-3 text-sm">
      <SessionControls />
      {session.message && <p role="alert">{session.message}</p>}
      {signedIn && identity ? (
        <>
          <dl className="space-y-2 break-all">
            <div>
              <dt className="text-muted-foreground">Verified subject</dt>
              <dd>{identity.subject}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Issuer</dt>
              <dd>{identity.issuer}</dd>
            </div>
          </dl>
          {process.env.NODE_ENV !== "production" && <RenewalCheck />}
        </>
      ) : session.phase === "authenticated" && !isLoading ? (
        <p role="alert">
          The backend has not accepted your session. Check its TideCloak issuer
          and client settings, or sign out and try again.
        </p>
      ) : (
        <p className="text-muted-foreground">
          Sign in to verify your identity with the backend.
        </p>
      )}
    </div>
  );
}

export function IdentityStatus() {
  const { configured, error } = useAuthConfiguration();
  return configured ? (
    <VerifiedIdentity />
  ) : (
    <p className="text-sm text-muted-foreground" role="status">
      {error ??
        "Sign-in is not configured. Follow the authentication setup guide to connect TideCloak and Convex."}
    </p>
  );
}
