import type { TideCloak } from "@tidecloak/js";

// The external SDK boundary; the application never stores or signs tokens.
export type TideClient = Pick<
  TideCloak,
  | "authenticated"
  | "idToken"
  | "idTokenParsed"
  | "init"
  | "login"
  | "logout"
  | "updateToken"
  | "clearToken"
> &
  Partial<
    Pick<
      TideCloak,
      "onAuthSuccess" | "onAuthRefreshError" | "onAuthLogout" | "onTokenExpired"
    >
  >;

type Snapshot = {
  phase: "loading" | "anonymous" | "authenticated" | "error";
  subject: string | null;
  message: string | null;
};

export class TideSession {
  private snapshot: Snapshot = {
    phase: "loading",
    subject: null,
    message: null,
  };
  private listeners = new Set<() => void>();
  private generation = 0;
  private initialization?: Promise<void>;
  private blocked = false;

  constructor(
    private client: TideClient,
    private config: {
      issuer: string;
      clientId: string;
      origin: string;
    },
  ) {
    client.onAuthSuccess = () => this.sync();
    client.onAuthRefreshError = () =>
      this.invalidate("Your session expired. Sign in again.");
    client.onAuthLogout = () => this.invalidate();
    client.onTokenExpired = () => {
      void this.fetchAccessToken({ forceRefreshToken: true });
    };
  }

  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private publish(snapshot: Snapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }

  private invalidate(message: string | null = null) {
    this.blocked = true;
    this.generation++;
    this.publish({
      phase: message ? "error" : "anonymous",
      subject: null,
      message,
    });
  }

  private sync() {
    if (this.blocked) return;
    if (!this.client.authenticated) {
      this.invalidate();
      return;
    }
    const claims = this.client.idTokenParsed;
    const audience = claims?.aud;
    if (
      !this.client.idToken ||
      typeof claims?.sub !== "string" ||
      !claims.sub ||
      claims.iss !== this.config.issuer ||
      !(
        audience === this.config.clientId ||
        (Array.isArray(audience) && audience.includes(this.config.clientId))
      ) ||
      typeof claims.exp !== "number" ||
      claims.exp <= Date.now() / 1000 ||
      (this.snapshot.subject !== null && this.snapshot.subject !== claims.sub)
    ) {
      this.invalidate(
        "The identity session could not be verified. Sign in again.",
      );
      return;
    }
    // These checks keep the UI consistent. Only Convex verifies the signature.
    this.publish({
      phase: "authenticated",
      subject: claims.sub,
      message: null,
    });
  }

  initialize = () => {
    this.initialization ??= (async () => {
      const generation = this.generation;
      try {
        await this.client.init({
          onLoad: "check-sso",
          flow: "standard",
          pkceMethod: "S256",
          responseMode: "query",
          scope: "openid profile",
          redirectUri: `${this.config.origin}/auth/redirect`,
          silentCheckSsoRedirectUri: `${this.config.origin}/silent-check-sso.html`,
          silentCheckSsoFallback: true,
          enableLogging: false,
          setupRequestEnclave: false,
          useDPoP: { mode: "strict", alg: "ES256" },
        });
        if (generation === this.generation) this.sync();
      } catch {
        if (generation === this.generation)
          this.invalidate(
            "Sign-in is unavailable. Check the identity service and reload.",
          );
      }
    })();
    return this.initialization;
  };

  fetchAccessToken = async ({
    forceRefreshToken,
  }: {
    forceRefreshToken: boolean;
  }): Promise<string | null> => {
    if (this.snapshot.phase !== "authenticated") return null;
    const generation = this.generation;
    try {
      // The SDK queues concurrent refreshes. Do not let a pending cache check
      // swallow Convex's request for a freshly issued token.
      await this.client.updateToken(forceRefreshToken ? -1 : 30);
      if (generation !== this.generation) return null;
      this.sync();
      return this.snapshot.phase === "authenticated"
        ? (this.client.idToken ?? null)
        : null;
    } catch {
      if (generation === this.generation)
        this.invalidate("Your session expired. Sign in again.");
      return null;
    }
  };

  verifyRenewal = async (
    verify: (token: string) => Promise<{ subject: string; issuer: string }>,
  ): Promise<boolean> => {
    if (this.snapshot.phase !== "authenticated") return false;
    const subject = this.snapshot.subject;
    const generation = this.generation;
    const token = await this.fetchAccessToken({ forceRefreshToken: true });
    if (!token || generation !== this.generation) return false;
    try {
      const identity = await verify(token);
      if (generation !== this.generation) return false;
      if (
        identity.subject !== subject ||
        identity.issuer !== this.config.issuer
      )
        throw new Error("Renewed identity mismatch");
      return true;
    } catch {
      if (generation === this.generation)
        this.invalidate(
          "Session renewal could not be verified. Sign in again.",
        );
      return false;
    }
  };

  login = async () => {
    this.invalidate();
    this.blocked = false;
    try {
      await this.client.login({
        redirectUri: `${this.config.origin}/auth/redirect`,
      });
    } catch {
      this.invalidate(
        "Sign-in could not start. Check the identity service and try again.",
      );
    }
  };

  logout = async () => {
    // Hide protected data and invalidate in-flight token requests before redirect.
    this.invalidate();
    try {
      // The SDK flushes DPoP state before constructing its end-session URL.
      // Keep its ID token hint until then; application access is already blocked.
      await this.client.logout({ redirectUri: `${this.config.origin}/app` });
      this.client.clearToken();
    } catch {
      this.client.clearToken();
      this.invalidate(
        "Signed out here. The identity service could not finish sign-out; close this tab or retry.",
      );
    }
  };
}
