import { env } from "cloudflare:workers";
import { jwtVerify, createRemoteJWKSet } from "jose";

type AuthEnv = Cloudflare.Env & {
  LOGIN_PASSWORD?: string;
  SESSION_SECRET?: string;
  UPDATE_KEY?: string;
  SITE_ORIGIN?: string;
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  CLERK_SECRET_KEY?: string;
};

const encoder = new TextEncoder();
export const sessionCookie = "__Host-fund_session";
export const sessionDuration = 60 * 60 * 24 * 7;

export function authEnv() {
  return env as AuthEnv;
}

export function getClerkPublishableKey(): string {
  const e = authEnv();
  return e.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "";
}

export function getClerkFrontendApi(): string | null {
  const pubKey = getClerkPublishableKey();
  if (!pubKey) return null;
  try {
    const raw = pubKey.replace(/^pk_(test|live)_/, "");
    return atob(raw).replace(/\$$/, "");
  } catch {
    return null;
  }
}

export function isClerkConfigured(): boolean {
  return !!getClerkPublishableKey();
}

async function digest(text: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(text)));
}

export async function equalSecret(a: string, b: string) {
  const x = await digest(a),
    y = await digest(b);
  let difference = 0;
  for (let i = 0; i < x.length; i++) difference |= x[i] ^ y[i];
  return difference === 0;
}

function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decode(text: string) {
  return Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (c) => c.charCodeAt(0));
}

async function mac(text: string) {
  const secret = authEnv().SESSION_SECRET;
  if (!secret) throw new Error("Sign-in is not configured.");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return encode(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(text))));
}

export async function createSession(now = Date.now()) {
  const payload = encode(encoder.encode(JSON.stringify({ v: 1, exp: Math.floor(now / 1000) + sessionDuration })));
  return payload + "." + (await mac(payload));
}

let jwksCache: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedDomain: string | null = null;

function getJWKS() {
  const domain = getClerkFrontendApi();
  if (!domain) return null;
  if (jwksCache && cachedDomain === domain) return jwksCache;
  const jwksUrl = new URL(`https://${domain}/.well-known/jwks.json`);
  jwksCache = createRemoteJWKSet(jwksUrl);
  cachedDomain = domain;
  return jwksCache;
}

export async function verifyClerkSessionToken(token: string): Promise<{ userId: string } | null> {
  const jwks = getJWKS();
  if (!jwks) return null;
  try {
    const { payload } = await jwtVerify(token, jwks);
    if (payload && payload.sub) {
      return { userId: payload.sub };
    }
  } catch (err) {
    // Expired or invalid token
  }
  return null;
}

export async function getAuthenticatedUser(
  headers?: Pick<Headers, "get">
): Promise<{ userId: string; provider: "clerk" | "legacy" } | null> {
  if (headers) {
    // 1. Check for Clerk session token in cookies (__session or __client_uat)
    const cookieHeader = headers.get("cookie") || "";
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    const sessionToken = cookies.find((c) => c.startsWith("__session="))?.slice(10);

    if (sessionToken) {
      const verified = await verifyClerkSessionToken(sessionToken);
      if (verified) {
        return { userId: verified.userId, provider: "clerk" };
      }
    }

    // 2. Check Authorization Bearer token if present
    const authHeader = headers.get("authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const bearerToken = authHeader.slice(7).trim();
      const verified = await verifyClerkSessionToken(bearerToken);
      if (verified) {
        return { userId: verified.userId, provider: "clerk" };
      }
    }

    // 3. Check legacy fixed password session cookie
    const legacyValid = await checkLegacyCookie(headers);
    if (legacyValid) {
      return { userId: "default-user", provider: "legacy" };
    }
  }

  return null;
}

async function checkLegacyCookie(headers: Pick<Headers, "get">, now = Date.now()): Promise<boolean> {
  try {
    const value = (headers.get("cookie") || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(sessionCookie + "="))
      ?.slice(sessionCookie.length + 1);
    if (!value || value.length > 1000) return false;
    const parts = value.split(".");
    if (parts.length !== 2) return false;
    if (!(await equalSecret(parts[1], await mac(parts[0])))) return false;
    const payload = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    return (
      payload.v === 1 &&
      Number.isInteger(payload.exp) &&
      payload.exp > Math.floor(now / 1000) &&
      payload.exp <= Math.floor(now / 1000) + sessionDuration + 60
    );
  } catch {
    return false;
  }
}

export async function sessionValid(headers: Pick<Headers, "get">, now = Date.now()): Promise<boolean> {
  const user = await getAuthenticatedUser(headers);
  return user !== null;
}

export async function writerAllowed(headers: Pick<Headers, "get">) {
  const key = authEnv().UPDATE_KEY,
    provided = headers.get("x-fund-update-key");
  return !!(key && provided && (await equalSecret(key, provided)));
}

export async function readerAllowed(headers: Pick<Headers, "get">) {
  return (await sessionValid(headers)) || (await writerAllowed(headers));
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const configured = authEnv().SITE_ORIGIN;
  if (configured && origin === configured) return true;
  try {
    const requestOrigin = new URL(request.url).origin;
    if (origin === requestOrigin) return true;
    const originUrl = new URL(origin);
    const reqUrl = new URL(request.url);
    if (
      (originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1") &&
      (reqUrl.hostname === "localhost" || reqUrl.hostname === "127.0.0.1") &&
      originUrl.port === reqUrl.port
    ) {
      return true;
    }
  } catch {}
  return false;
}

export function deny() {
  return Response.json({ error: "Please sign in." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
