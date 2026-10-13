import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handler, json, parseBody, requireSession } from "@/lib/api";
import { verifyDeposit } from "@/lib/solana";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ signature: z.string().min(64).max(128) });

/** Creator submits the signature of their USDC deposit; we verify and activate. */
export const POST = handler<Ctx>(async (req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const { signature } = await parseBody(req, Body);

  const c = await prisma.campaign.findUnique({ where: { id } });
  if (!c) throw new ApiError(404, "Campaign not found");
  if (c.creatorId !== session.userId) throw new ApiError(403, "Not your campaign");
  if (c.status !== "DRAFT") throw new ApiError(409, "Campaign already funded");

  const used = await prisma.campaign.findUnique({ where: { fundingTxSig: signature } });
  if (used) throw new ApiError(409, "That transaction already funded a campaign");

  const check = await verifyDeposit({ signature, expectedCents: c.totalCents, memo: c.id });
  if (!check.ok) throw new ApiError(400, check.reason);

  await prisma.campaign.update({
    where: { id },
    data: { status: "ACTIVE", fundingTxSig: signature, fundedAt: new Date() },
  });
  return json({ ok: true, status: "ACTIVE" });
});
