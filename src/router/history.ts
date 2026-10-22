import { createBrowserHistory } from "@tanstack/react-router";

export function createWorkspaceHistory() {
  // TanStack decorates pushState/replaceState to notify its subscribers.
  // Keep those decorations on a facade: Next also writes browser history from
  // an insertion effect, where synchronous React updates are not permitted.
  // Writes still use Next's public history integration and real popstate events.
  const browserHistory = window.history;
  const historyWindow = {
    location: window.location,
    document: window.document,
    addEventListener: window.addEventListener.bind(window),
    removeEventListener: window.removeEventListener.bind(window),
    history: {
      get state() {
        return browserHistory.state;
      },
      get length() {
        return browserHistory.length;
      },
      pushState: browserHistory.pushState.bind(browserHistory),
      replaceState: browserHistory.replaceState.bind(browserHistory),
      back: browserHistory.back.bind(browserHistory),
      forward: browserHistory.forward.bind(browserHistory),
      go: browserHistory.go.bind(browserHistory),
    },
  };

  return createBrowserHistory({ window: historyWindow });
}
