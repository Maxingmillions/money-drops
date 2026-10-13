import { prisma } from "@/lib/db";
import { ApiError, handler, json, requireSession } from "@/lib/api";
import { takeDownBounty } from "@/lib/moderation";

type Ctx = { params: Promise<{ id: string }> };

/** Creator closes their own bounty: pending submissions are rejected and unpaid rewards refunded. */
export const POST = handler<Ctx>(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const b = await prisma.bounty.findUnique({ where: { id }, select: { creatorId: true, status: true } });
  if (!b) throw new ApiError(404, "Bounty not found");
  if (b.creatorId !== session.userId) throw new ApiError(403, "Not your bounty");
  if (b.status !== "OPEN" && b.status !== "DRAFT") throw new ApiError(409, "This bounty is already closed");
  return json(await takeDownBounty(id, "Closed by creator"));
});
