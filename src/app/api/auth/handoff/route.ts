import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ApiError, handler, json, requireSession } from "@/lib/api";
import { SESSION_COOKIE, sessionCookieOptions, sessionToken } from "@/lib/session";
import { appOrigin } from "@/lib/oauth";

const TTL_MS = 5 * 60 * 1000;

/**
 * Session hand-off: wallet in-app browsers (Phantom on iOS) block geolocation,
 * so the user signs in there, then opens a one-time link in Safari/Chrome that
 * carries the same session across. Tokens are single-use and expire in 5 min.
 */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const value = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await prisma.nonce.create({ data: { value: `handoff:${value}`, wallet: `${session.userId}:${session.wallet}`, expiresAt: new Date(Date.now() + TTL_MS) } });
  const url = `${appOrigin(req)}/api/auth/handoff?t=${value}`;
  return json({ url, expiresInS: TTL_MS / 1000 });
});

export const GET = handler(async (req) => {
  const t = new URL(req.url).searchParams.get("t") ?? "";
  const origin = appOrigin(req);
  if (!/^[a-f0-9]{64}$/.test(t)) throw new ApiError(400, "Bad hand-off link");
  const row = await prisma.nonce.findUnique({ where: { value: `handoff:${t}` } });
  // Browsers sometimes fetch a navigation twice (prefetch, reload); allow a
  // short grace window after first use so the second request still lands.
  const GRACE_MS = 60_000;
  if (!row || row.expiresAt < new Date() || (row.usedAt && Date.now() - row.usedAt.getTime() > GRACE_MS)) {
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent("That hand-off link expired. Open Drops in your wallet and tap Open in Safari again.")}`, 303);
  }
  if (!row.usedAt) await prisma.nonce.update({ where: { value: row.value }, data: { usedAt: new Date() } });
  const [userId, wallet] = row.wallet.split(":");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.wallet !== wallet) throw new ApiError(400, "Account not found");
  const res = NextResponse.redirect(`${origin}/map?handoff=1`, 303);
  res.cookies.set(SESSION_COOKIE, await sessionToken({ userId: user.id, wallet: user.wallet }), sessionCookieOptions());
  return res;
});
