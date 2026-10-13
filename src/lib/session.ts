import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./db";

const COOKIE = "md_session";
const MAX_AGE_S = 60 * 60 * 24 * 7;

let warned = false;
function secret() {
  let s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set to a long random string");
    }
    if (!warned) {
      console.warn("SESSION_SECRET not set; using an insecure dev default. Run `npm run setup` to create .env.");
      warned = true;
    }
    s = "money-drops-insecure-dev-secret";
  }
  return new TextEncoder().encode(s);
}

export type Session = { userId: string; wallet: string };

export async function createSession(session: Session) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_S}s`)
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_S,
  });
}

export async function clearSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (typeof payload.userId !== "string" || typeof payload.wallet !== "string") {
      return null;
    }
    return { userId: payload.userId, wallet: payload.wallet };
  } catch {
    return null;
  }
}

/** Session plus the user row, or null when signed out. */
export async function getCurrentUser() {
  const session = await getSession();
  if (!session) return null;
  return prisma.user.findUnique({ where: { id: session.userId } });
}
