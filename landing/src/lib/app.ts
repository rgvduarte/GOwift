// What the page says about the game server it links to. Plain functions of
// their inputs, so they can be tested without Astro's build environment.

/** The server's address without the scheme, e.g. "goindoor.onrender.com". */
export function appHostOf(appUrl: string): string {
  return appUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * The main call to action. It names what the visitor does, not where the
 * server is hosted (that goes into a note under the button), and stays short
 * so the button fits a 320 px phone on one line.
 */
export function startLabel(hasApp: boolean): string {
  return hasApp ? "Start riding free" : "Get started";
}
