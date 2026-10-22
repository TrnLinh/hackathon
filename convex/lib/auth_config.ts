import type { AuthConfig } from "convex/server";

export function tideAuthConfig(env: {
  TIDECLOAK_ISSUER?: string;
  TIDECLOAK_CLIENT_ID?: string;
}): AuthConfig {
  const issuer = env.TIDECLOAK_ISSUER?.trim();
  const clientId = env.TIDECLOAK_CLIENT_ID?.trim();
  if (!issuer && !clientId) return { providers: [] };
  if (!issuer || !clientId) {
    throw new Error("Set both TIDECLOAK_ISSUER and TIDECLOAK_CLIENT_ID.");
  }
  const url = new URL(issuer);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(loopback && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^\/.*realms\/[^/]+$/.test(url.pathname)
  ) {
    throw new Error(
      "TIDECLOAK_ISSUER must be an HTTPS realm URL (HTTP only on loopback), without a trailing slash.",
    );
  }
  return { providers: [{ domain: issuer, applicationID: clientId }] };
}
