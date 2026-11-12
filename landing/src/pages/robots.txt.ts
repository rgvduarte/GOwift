import type { APIRoute } from "astro";
import { href } from "../site";

export const GET: APIRoute = ({ site }) =>
  new Response(`User-agent: *\nAllow: /\n\nSitemap: ${new URL(href("sitemap-index.xml"), site).href}\n`);
