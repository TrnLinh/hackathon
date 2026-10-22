"use client";

import { useConvexConnectionState, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useBackendConfigured } from "@/components/providers";
import { Badge } from "@/components/ui/badge";

function ConnectedStatus() {
  const connection = useConvexConnectionState();
  const status = useQuery(api.system.status);
  const connected = connection.isWebSocketConnected && status !== undefined;

  return (
    <div className="space-y-2" role="status">
      <Badge variant={connected ? "default" : "secondary"}>
        {connected ? "Connected" : "Connecting"}
      </Badge>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {connected
          ? "The client is receiving a live response from the Chorus Convex backend."
          : "Waiting for the configured Convex deployment. Make sure its dev server is running."}
      </p>
    </div>
  );
}

export function ConvexStatus() {
  const configured = useBackendConfigured();
  if (!configured) {
    return (
      <div className="space-y-2" role="status">
        <Badge variant="outline">Not configured</Badge>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Run the Convex setup in the README, then restart Next.js to connect
          the backend.
        </p>
      </div>
    );
  }
  return <ConnectedStatus />;
}
