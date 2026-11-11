/**
 * Fallback shim for `cloudflare:workers` when building or running with standard
 * Next.js / Node.js (e.g., on Vercel) outside the Cloudflare Workers / vinext runtime.
 */
export const env: Record<string, unknown> =
  typeof process !== "undefined" && process.env ? process.env : {};

