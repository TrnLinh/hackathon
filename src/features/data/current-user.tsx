"use client";

import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@convex/_generated/api";

/**
 * Registers the signed-in person in the backend registry. The server derives
 * the identity from the verified token; nothing is sent from the client.
 */
export function EnsureCurrentUser() {
  const { isAuthenticated } = useConvexAuth();
  const ensure = useMutation(api.users.ensureCurrent);
  useEffect(() => {
    if (isAuthenticated) void ensure({}).catch(() => {});
  }, [isAuthenticated, ensure]);
  return null;
}

/** The caller's registry summary; null when signed out or not yet registered. */
export function useViewer() {
  return useQuery(api.users.viewer);
}
