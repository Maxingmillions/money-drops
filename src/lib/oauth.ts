import "server-only";
import { NextResponse } from "next/server";
import { SignJWT, jwtVerify, createRemoteJWKSet } from "jose";
import { prisma } from "./db";
import { createCustodialWallet } from "./custody";
import { syncRole } from "./roles";
import { SESSION_COOKIE, sessionCookieOptions, sessionSecret, sessionToken } from "./session";

/**
 * Google and Apple sign-in, done the plain OpenID Connect way: redirect to the
 * provider, get an ID token back, verify it against the provider's public keys,
 * then find-or-create the account. No SDKs, no third-party auth service.
 */

export type Provider = "google" | "apple";
const STATE_COOKIE = "md_oauth";
const STATE_TTL_S = 10 * 60;

export const providerConfig = {
  google: {
    clientId: () => process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET || "",
    jwks: createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs")),
    issuers: ["https://accounts.google.com", "accounts.google.com"],
  },
  apple: {
    clientId: () => process.env.APPLE_CLIENT_ID || "",
    clientSecret: () => "",
    jwks: createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys")),
    issuers: ["https://appleid.apple.com"],
  },
};

export const googleEnabled = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const appleEnabled = () => Boolean(process.env.APPLE_CLIENT_ID);

/** Public origin for redirect URIs; override with APP_URL behind odd proxies. */
export function appOrigin(req: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const url = new URL(req.url);
  const proto = (req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "")).split(",")[0];
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host).split(",")[0];
  return `${proto}://${host}`;
}

export const redirectUri = (req: Request, provider: Provider) => `${appOrigin(req)}/api/auth/${provider}/callback`;

/** Only allow same-site paths as the post-login destination. */
export function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/home";
}

/** Signed state: proves the callback belongs to a flow this server started. */
export async function issueState(provider: Provider, next: string) {
  const nonce = crypto.randomUUID();
  const state = crypto.randomUUID();
  const token = await new SignJWT({ provider, next, nonce, state })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${STATE_TTL_S}s`)
    .sign(sessionSecret());
  return { nonce, state, token };
}

export function setStateCookie(res: NextResponse, token: string, provider: Provider) {
  res.cookies.set(STATE_COOKIE, token, {
    httpOnly: true,
    // Apple posts the result back cross-site (form_post), which Lax cookies would not survive.
    sameSite: provider === "apple" ? "none" : "lax",
    secure: provider === "apple" || process.env.NODE_ENV === "production",
    path: "/api/auth",
    maxAge: STATE_TTL_S,
  });
}

export async function readState(req: Request, provider: Provider, state: string | null) {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${STATE_COOKIE}=([^;]+)`));
  if (!m || !state) throw new Error("Sign-in session expired. Try again.");
  const { payload } = await jwtVerify(decodeURIComponent(m[1]), sessionSecret());
  if (payload.provider !== provider || payload.state !== state) throw new Error("Sign-in session didn't match. Try again.");
  return { nonce: String(payload.nonce), next: safeNext(typeof payload.next === "string" ? payload.next : null) };
}

export type Identity = { provider: Provider; subject: string; email: string | null; emailVerified: boolean; name: string | null };

/** Verifies a provider ID token and extracts what we need from it. */
export async function verifyIdToken(provider: Provider, idToken: string, nonce: string): Promise<Identity> {
  const cfg = providerConfig[provider];
  const { payload } = await jwtVerify(idToken, cfg.jwks, { issuer: cfg.issuers, audience: cfg.clientId() });
  if (payload.nonce !== nonce) throw new Error("Nonce mismatch");
  if (typeof payload.sub !== "string") throw new Error("No subject in token");
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  const ev = payload.email_verified;
  const emailVerified = ev === true || ev === "true";
  const name = typeof payload.name === "string" ? payload.name : null;
  return { provider, subject: payload.sub, email, emailVerified, name };
}

/** Finds the account for this identity, linking by verified email, or creates one with a custodial wallet. */
export async function findOrCreateUser(id: Identity, fallbackName?: string | null) {
  const idField = id.provider === "google" ? "googleId" : "appleId";
  let user = await prisma.user.findUnique({ where: { [idField]: id.subject } as never });
  if (!user && id.email && id.emailVerified) {
    const byEmail = await prisma.user.findUnique({ where: { email: id.email } });
    if (byEmail) user = await prisma.user.update({ where: { id: byEmail.id }, data: { [idField]: id.subject } });
  }
  if (!user) {
    const wallet = createCustodialWallet();
    // Only claim the email column when nobody else has it (unverified emails are stored nowhere).
    const emailFree = id.email && id.emailVerified && !(await prisma.user.findUnique({ where: { email: id.email } }));
    user = await prisma.user.create({
      data: {
        [idField]: id.subject,
        email: emailFree ? id.email : null,
        wallet: wallet.address,
        custodialSecret: wallet.custodialSecret,
        loginMethod: id.provider,
        handle: await freeHandle(id.name ?? fallbackName ?? null),
      },
    });
    await syncRole(user.id, user.wallet);
  }
  return user;
}

async function freeHandle(name: string | null) {
  if (!name) return null;
  const base = name.toLowerCase().replace(/[^a-z0-9_.]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 20);
  if (base.length < 2) return null;
  for (let i = 0; i < 5; i++) {
    const h = i === 0 ? base : `${base}${Math.floor(Math.random() * 9000 + 1000)}`;
    if (!(await prisma.user.findUnique({ where: { handle: h } }))) return h;
  }
  return null;
}

/** Signs the user in and sends them on; clears the state cookie. */
export async function finishSignIn(req: Request, user: { id: string; wallet: string }, next: string) {
  const res = NextResponse.redirect(`${appOrigin(req)}${next}`, 303);
  res.cookies.set(SESSION_COOKIE, await sessionToken({ userId: user.id, wallet: user.wallet }), sessionCookieOptions());
  res.cookies.set(STATE_COOKIE, "", { path: "/api/auth", maxAge: 0 });
  return res;
}

export function failSignIn(req: Request, message: string) {
  const url = new URL(`${appOrigin(req)}/sign-in`);
  url.searchParams.set("error", message);
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(STATE_COOKIE, "", { path: "/api/auth", maxAge: 0 });
  return res;
}
