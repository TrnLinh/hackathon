"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";

/**
 * Registers the signed-in person in the backend registry. The server derives
 * the identity from the verified token; nothing is sent from the client.
 */
export function EnsureCurrentUser() {
  const { isAuthenticated } = useConvexAuth();
  const ensure = useMutation(api.users.ensureCurrent);
  const [failures, setFailures] = useState(0);
  useEffect(() => {
    if (!isAuthenticated) return;
    let timer: number | undefined;
    let active = true;
    // Retry with backoff; screens wait for the registry row meanwhile.
    ensure({}).catch(() => {
      if (active)
        timer = window.setTimeout(
          () => setFailures((n) => n + 1),
          Math.min(30_000, 1_000 * 2 ** failures),
        );
    });
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [isAuthenticated, ensure, failures]);
  return null;
}

/** The caller's registry summary; null when signed out or not yet registered. */
export function useViewer() {
  return useQuery(api.users.viewer);
}
