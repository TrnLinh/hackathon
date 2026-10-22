"use client";

import { ConvexProviderWithAuth, type ConvexReactClient } from "convex/react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { BrowserAuthConfig } from "./config";
import { TideSession } from "./session";

const SessionContext = createContext<TideSession | null>(null);

function useTideAuth() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Missing Tide session provider.");
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return useMemo(
    () => ({
      isLoading: state.phase === "loading",
      isAuthenticated: state.phase === "authenticated",
      fetchAccessToken: session.fetchAccessToken,
    }),
    [state.phase, session],
  );
}

export function useTideSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("Missing Tide session provider.");
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  );
  return { ...state, login: session.login, logout: session.logout };
}

export default function AuthProvider({
  config,
  client,
  children,
}: {
  config: BrowserAuthConfig;
  client: ConvexReactClient;
  children: ReactNode;
}) {
  // A component-scoped promise prevents double initialization under StrictMode.
  const [initialization] = useState(() => {
    let session: Promise<TideSession> | undefined;
    return () =>
      (session ??= import("@tidecloak/js").then(({ TideCloak }) => {
        const sdk = new TideCloak({ ...config, setupRequestEnclave: false });
        return new TideSession(sdk, {
          ...config,
          origin: window.location.origin,
        });
      }));
  });
  const [session, setSession] = useState<TideSession | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    initialization()
      .then(async (session) => {
        if (active) setSession(session);
        await session.initialize();
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [initialization]);

  if (!session)
    return (
      <main className="grid min-h-screen place-items-center p-6" role="status">
        {failed
          ? "Sign-in could not load. Reload the app to try again."
          : "Opening your secure workspace…"}
      </main>
    );
  return (
    <SessionContext.Provider value={session}>
      <ConvexProviderWithAuth client={client} useAuth={useTideAuth}>
        {children}
      </ConvexProviderWithAuth>
    </SessionContext.Provider>
  );
}
