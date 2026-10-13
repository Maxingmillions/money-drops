import { prisma } from "@/lib/db";
import { ApiError, handler, json, requireSession } from "@/lib/api";
import { isMod } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

/** Mods (or the author) delete a chat message. */
export const DELETE = handler<Ctx>(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const me = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const m = await prisma.message.findUnique({ where: { id } });
  if (!m) throw new ApiError(404, "Message not found");
  if (!isMod(me.role) && m.userId !== me.id) throw new ApiError(403, "Mods only");
  await prisma.message.delete({ where: { id } });
  return json({ ok: true });
});
