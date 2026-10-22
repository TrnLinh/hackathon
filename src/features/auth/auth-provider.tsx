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
import type { ProofSdk } from "../policy-proof/tide";

const SessionContext = createContext<TideSession | null>(null);
const ProofSdkContext = createContext<ProofSdk | null>(null);

export function useProofSdk() {
  const sdk = useContext(ProofSdkContext);
  const session = useContext(SessionContext);
  return () => {
    if (!sdk || session?.getSnapshot().phase !== "authenticated")
      throw new Error("Sign in before running a Tide proof.");
    return sdk;
  };
}

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
    let session: Promise<{ session: TideSession; sdk: ProofSdk }> | undefined;
    return () =>
      (session ??= import("@tidecloak/js").then(({ TideCloak }) => {
        const sdk = new TideCloak({ ...config, setupRequestEnclave: false });
        return {
          sdk,
          session: new TideSession(sdk, {
            ...config,
            origin: window.location.origin,
          }),
        };
      }));
  });
  const [session, setSession] = useState<TideSession | null>(null);
  const [sdk, setSdk] = useState<ProofSdk | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    initialization()
      .then(async ({ session, sdk }) => {
        if (active) {
          setSession(session);
          setSdk(sdk);
        }
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
      <ProofSdkContext.Provider value={sdk}>
        <ConvexProviderWithAuth client={client} useAuth={useTideAuth}>
          {children}
        </ConvexProviderWithAuth>
      </ProofSdkContext.Provider>
    </SessionContext.Provider>
  );
}
