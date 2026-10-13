import { z } from "zod";
import { ApiError, handler, json, parseBody, requireSession } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireMod } from "@/lib/roles";
import { takeDownCampaign } from "@/lib/moderation";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ action: z.literal("takedown"), note: z.string().trim().max(500).optional() });

export const POST = handler<Ctx>(async (req, { params }) => {
  const session = await requireSession();
  await requireMod(session);
  const { id } = await params;
  const body = await parseBody(req, Body);
  return json(await takeDownCampaign(id, body.note));
});

/** Admins delete a post outright: refunds like a take-down, then removes it. */
export const DELETE = handler<Ctx>(async (_req, { params }) => {
  const session = await requireSession();
  const me = await requireMod(session);
  if (me.role !== "ADMIN") throw new ApiError(403, "Admins only");
  const { id } = await params;
  try {
    await takeDownCampaign(id, "Deleted by admin");
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 409)) throw e; // already taken down is fine
  }
  await prisma.claim.deleteMany({ where: { campaignId: id } });
  await prisma.campaign.delete({ where: { id } }); // drops cascade
  return json({ ok: true, deleted: true });
});
