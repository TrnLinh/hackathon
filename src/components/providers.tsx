"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createContext, useContext, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { browserAuthConfig } from "@/features/auth/config";

const AuthProvider = dynamic(() => import("@/features/auth/auth-provider"), {
  ssr: false,
});

const BackendConfiguredContext = createContext(false);
const AuthConfigurationContext = createContext({
  configured: false,
  error: null as string | null,
});

export function useAuthConfiguration() {
  return useContext(AuthConfigurationContext);
}

export function useBackendConfigured() {
  return useContext(BackendConfiguredContext);
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [auth] = useState(() => {
    try {
      return {
        config: browserAuthConfig({
          NEXT_PUBLIC_TIDECLOAK_URL: process.env.NEXT_PUBLIC_TIDECLOAK_URL,
          NEXT_PUBLIC_TIDECLOAK_REALM: process.env.NEXT_PUBLIC_TIDECLOAK_REALM,
          NEXT_PUBLIC_TIDECLOAK_CLIENT_ID:
            process.env.NEXT_PUBLIC_TIDECLOAK_CLIENT_ID,
          NEXT_PUBLIC_TIDECLOAK_VENDOR_ID:
            process.env.NEXT_PUBLIC_TIDECLOAK_VENDOR_ID,
          NEXT_PUBLIC_TIDECLOAK_HOME_ORK_URL:
            process.env.NEXT_PUBLIC_TIDECLOAK_HOME_ORK_URL,
          NEXT_PUBLIC_TIDECLOAK_CLIENT_ORIGIN_AUTH:
            process.env.NEXT_PUBLIC_TIDECLOAK_CLIENT_ORIGIN_AUTH,
        }),
        error: null,
      };
    } catch {
      return {
        config: null,
        error:
          "Identity configuration is invalid. Check the TideCloak environment settings and restart the app.",
      };
    }
  });
  const [client] = useState(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
    return url ? new ConvexReactClient(url) : null;
  });

  return (
    <AuthConfigurationContext.Provider
      value={{
        configured: auth.config !== null && client !== null,
        error: auth.error,
      }}
    >
      <BackendConfiguredContext.Provider value={client !== null}>
        {client && auth.config ? (
          <AuthProvider config={auth.config} client={client}>
            {children}
          </AuthProvider>
        ) : client ? (
          <ConvexProvider client={client}>{children}</ConvexProvider>
        ) : (
          children
        )}
      </BackendConfiguredContext.Provider>
    </AuthConfigurationContext.Provider>
  );
}
