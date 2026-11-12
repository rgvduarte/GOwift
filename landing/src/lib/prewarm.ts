// Waking a sleeping game server while the visitor reads. A free Render
// server sleeps after 15 minutes without riders and takes about a minute to
// start again (docs/deploy.md), so one early request saves most of that wait.
// See ADR 0028.

/** The address to request so a sleeping server starts: its health check. */
export function prewarmUrl(appUrl: string): string | null {
  if (!/^https?:\/\//.test(appUrl)) return null;
  return new URL("/healthz", appUrl).href;
}

interface WakeDeps {
  fetch: (url: string, init: RequestInit) => Promise<unknown>;
  /** `navigator.connection` where the browser has it. */
  connection?: { saveData?: boolean } | null;
}

/**
 * A function that wakes the server: the first call sends one request, later
 * calls do nothing. The request is `no-cors` (the page never reads the
 * answer, so the server needs no CORS headers), sends no cookies or referrer,
 * and every failure is ignored, so it can never block or break the page.
 * Visitors who asked their browser to save data are left alone.
 */
export function createWake(url: string | null, { fetch, connection }: WakeDeps): () => void {
  let done = false;
  return () => {
    if (done || !url || connection?.saveData) return;
    done = true;
    try {
      fetch(url, {
        mode: "no-cors",
        cache: "no-store",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Blocked by the browser or an extension: the click still works.
    }
  };
}
