"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { createContext, useContext, useState, type ReactNode } from "react";

const BackendConfiguredContext = createContext(false);

export function useBackendConfigured() {
  return useContext(BackendConfiguredContext);
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL?.trim();
    return url ? new ConvexReactClient(url) : null;
  });

  return (
    <BackendConfiguredContext.Provider value={client !== null}>
      {client ? (
        <ConvexProvider client={client}>{children}</ConvexProvider>
      ) : (
        children
      )}
    </BackendConfiguredContext.Provider>
  );
}
