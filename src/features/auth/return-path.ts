// Where to land after sign-in, e.g. back on a join link. Only same-origin
// workspace paths are accepted; anything else falls back to /app.

const KEY = "chorus-return-path";

export function safeReturnPath(path: string | null | undefined) {
  if (!path || path.length > 512) return "/app";
  if (/[\\\s]/.test(path) || path.startsWith("//")) return "/app";
  return path === "/app" || /^\/app[/?#]/.test(path) ? path : "/app";
}

export function rememberReturnPath() {
  try {
    const { pathname, search } = window.location;
    window.sessionStorage.setItem(KEY, safeReturnPath(pathname + search));
  } catch {
    // Storage unavailable: sign-in still returns to /app.
  }
}

export function readReturnPath() {
  try {
    return safeReturnPath(window.sessionStorage.getItem(KEY));
  } catch {
    return "/app";
  }
}

export function clearReturnPath() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
