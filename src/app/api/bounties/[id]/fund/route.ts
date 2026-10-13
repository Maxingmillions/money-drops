import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handler, json, parseBody, requireSession } from "@/lib/api";
import { verifyDeposit } from "@/lib/solana";
import { collectFee, totalWithFee } from "@/lib/pool";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ signature: z.string().min(64).max(128) });

export const POST = handler<Ctx>(async (req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const { signature } = await parseBody(req, Body);
  const b = await prisma.bounty.findUnique({ where: { id } });
  if (!b) throw new ApiError(404, "Bounty not found");
  if (b.creatorId !== session.userId) throw new ApiError(403, "Not your bounty");
  if (b.status !== "DRAFT") throw new ApiError(409, "Bounty already funded");
  const used = await prisma.bounty.findUnique({ where: { fundingTxSig: signature } });
  if (used) throw new ApiError(409, "That transaction already funded a bounty");
  const check = await verifyDeposit({ signature, expectedLamports: totalWithFee(b.rewardLamports * b.maxWinners), memo: b.id });
  if (!check.ok) throw new ApiError(400, check.reason);
  await prisma.bounty.update({ where: { id }, data: { status: "OPEN", fundingTxSig: signature, fundedAt: new Date() } });
  await collectFee({ lamports: b.rewardLamports * b.maxWinners, source: `bounty:${b.id}`, onChain: true });
  return json({ ok: true, status: "OPEN" });
});
