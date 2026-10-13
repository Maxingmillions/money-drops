import { prisma } from "@/lib/db";
import { ApiError, handler, json, requireSession } from "@/lib/api";
import { takeDownCampaign } from "@/lib/moderation";

type Ctx = { params: Promise<{ id: string }> };

/** Creator ends their own hunt early: unclaimed drops are returned and the SOL refunded. */
export const POST = handler<Ctx>(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const c = await prisma.campaign.findUnique({ where: { id }, select: { creatorId: true, status: true } });
  if (!c) throw new ApiError(404, "Hunt not found");
  if (c.creatorId !== session.userId) throw new ApiError(403, "Not your hunt");
  if (c.status !== "ACTIVE" && c.status !== "DRAFT") throw new ApiError(409, "This hunt is already over");
  return json(await takeDownCampaign(id, "Ended by creator"));
});
