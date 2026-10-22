import { createDpopRoute } from "@tidecloak/js/dpop-route";
import { browserAuthConfig } from "../../../features/auth/config";

export function GET(request: Request): Response {
  const config = browserAuthConfig({
    NEXT_PUBLIC_TIDECLOAK_URL: process.env.NEXT_PUBLIC_TIDECLOAK_URL,
    NEXT_PUBLIC_TIDECLOAK_REALM: process.env.NEXT_PUBLIC_TIDECLOAK_REALM,
    NEXT_PUBLIC_TIDECLOAK_CLIENT_ID:
      process.env.NEXT_PUBLIC_TIDECLOAK_CLIENT_ID,
  });
  if (!config) return new Response("Not Found", { status: 404 });

  return createDpopRoute({
    config: {
      "auth-server-url": config.url,
      realm: config.realm,
      resource: config.clientId,
    },
  }).GET(request);
}

export const HEAD = GET;
