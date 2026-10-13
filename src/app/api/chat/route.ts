import { z } from "zod";
import { prisma } from "@/lib/db";
import { handler, json, parseBody, requireSession } from "@/lib/api";
import { shortWallet } from "@/lib/drops";
import { assertNotSpam } from "@/lib/moderate";

const ROOM = "global";

/** Latest messages, or messages after `after` (message id) for polling. */
export const GET = handler(async (req) => {
  const session = await requireSession();
  const url = new URL(req.url);
  const after = url.searchParams.get("after");
  const cursor = after ? await prisma.message.findUnique({ where: { id: after }, select: { createdAt: true } }) : null;
  const rows = await prisma.message.findMany({
    where: { room: ROOM, ...(cursor ? { createdAt: { gt: cursor.createdAt } } : {}) },
    include: { user: true },
    orderBy: { createdAt: cursor ? "asc" : "desc" },
    take: 60,
  });
  const messages = (cursor ? rows : rows.reverse()).map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
    user: m.user.handle ?? shortWallet(m.user.wallet),
    role: m.user.role,
    mine: m.userId === session.userId,
  }));
  return json({ messages });
});

const Body = z.object({ body: z.string().trim().min(1).max(500) });

export const POST = handler(async (req) => {
  const session = await requireSession();
  const { body } = await parseBody(req, Body);
  // Light rate limit: 1 message / 1.5 s per user.
  const last = await prisma.message.findFirst({ where: { userId: session.userId }, orderBy: { createdAt: "desc" } });
  if (last && Date.now() - last.createdAt.getTime() < 1500) return json({ error: "Slow down" }, { status: 429 });
  await assertNotSpam("chat", body);
  const m = await prisma.message.create({ data: { room: ROOM, userId: session.userId, body } });
  return json({ id: m.id });
});
