import { tideAuthConfig } from "../../../convex/lib/auth_config";

export function browserAuthConfig(env: {
  NEXT_PUBLIC_TIDECLOAK_URL?: string;
  NEXT_PUBLIC_TIDECLOAK_REALM?: string;
  NEXT_PUBLIC_TIDECLOAK_CLIENT_ID?: string;
  NEXT_PUBLIC_TIDECLOAK_VENDOR_ID?: string;
  NEXT_PUBLIC_TIDECLOAK_HOME_ORK_URL?: string;
  NEXT_PUBLIC_TIDECLOAK_CLIENT_ORIGIN_AUTH?: string;
}) {
  const url = env.NEXT_PUBLIC_TIDECLOAK_URL?.trim();
  const realm = env.NEXT_PUBLIC_TIDECLOAK_REALM?.trim();
  const clientId = env.NEXT_PUBLIC_TIDECLOAK_CLIENT_ID?.trim();
  if (!url && !realm && !clientId) return null;
  if (!url || !realm || !clientId || !/^[a-zA-Z0-9._-]+$/.test(realm)) {
    throw new Error(
      "Set the TideCloak URL, realm, and client ID in .env.local, then restart the app.",
    );
  }
  const baseUrl = url.replace(/\/$/, "");
  const issuer = `${baseUrl}/realms/${realm}`;
  tideAuthConfig({ TIDECLOAK_ISSUER: issuer, TIDECLOAK_CLIENT_ID: clientId });
  return {
    url: baseUrl,
    realm,
    clientId,
    issuer,
    vendorId: env.NEXT_PUBLIC_TIDECLOAK_VENDOR_ID?.trim(),
    homeOrkUrl: env.NEXT_PUBLIC_TIDECLOAK_HOME_ORK_URL?.trim(),
    clientOriginAuth: env.NEXT_PUBLIC_TIDECLOAK_CLIENT_ORIGIN_AUTH?.trim(),
  };
}

export type BrowserAuthConfig = NonNullable<
  ReturnType<typeof browserAuthConfig>
>;
