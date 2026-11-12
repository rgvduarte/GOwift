/**
 * Which build of the client this is. The Dockerfile overwrites this file with
 * the git commit and date (GOINDOOR_BUILD_SHA / GOINDOOR_BUILD_DATE);
 * `dev` is what you get when running from a checkout.
 */
export const BUILD = { sha: "dev", date: "" };
