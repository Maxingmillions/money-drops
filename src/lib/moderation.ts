import "server-only";
import { prisma } from "./db";
import { ApiError } from "./api";
import { devSkipFunding, payout, treasuryKeypair } from "./solana";

/** Try to send `cents` back to `wallet`; returns the tx signature or null when not on-chain. */
async function refundOnChain(opts: { funded: boolean; wallet: string; cents: number }) {
  if (opts.cents <= 0) return { txSig: null, note: "nothing to refund" };
  if (opts.funded && treasuryKeypair()) {
    const txSig = await payout({ recipient: opts.wallet, cents: opts.cents });
    return { txSig, note: "refunded on-chain" };
  }
  return { txSig: null, note: devSkipFunding() ? "refund recorded (dev mode, no on-chain funds)" : "refund pending: not funded on-chain or treasury not configured" };
}

/** Take a campaign down: hidden drops are returned and the creator refunded. */
export async function takeDownCampaign(id: string, note: string | undefined) {
  const c = await prisma.campaign.findUnique({ where: { id }, include: { creator: true } });
  if (!c) throw new ApiError(404, "Campaign not found");
  if (c.status === "REFUNDED") throw new ApiError(409, "Already taken down");
  const hidden = await prisma.drop.findMany({ where: { campaignId: id, status: "HIDDEN" }, select: { amountCents: true } });
  const cents = hidden.reduce((s, d) => s + d.amountCents, 0);
  await prisma.drop.updateMany({ where: { campaignId: id, status: "HIDDEN" }, data: { status: "RETURNED" } });
  const r = await refundOnChain({ funded: Boolean(c.fundingTxSig), wallet: c.creator.wallet, cents });
  await prisma.campaign.update({
    where: { id },
    data: { status: "REFUNDED", refundTxSig: r.txSig, refundedCents: cents, modNote: note ?? null },
  });
  return { refundedCents: cents, txSig: r.txSig, note: r.note };
}

/** Take a bounty down: pending submissions rejected, unpaid rewards refunded. */
export async function takeDownBounty(id: string, note: string | undefined) {
  const b = await prisma.bounty.findUnique({ where: { id }, include: { creator: true } });
  if (!b) throw new ApiError(404, "Bounty not found");
  if (b.status === "REFUNDED" || b.status === "CLOSED") throw new ApiError(409, "Already taken down");
  const paid = await prisma.submission.count({ where: { bountyId: id, status: "APPROVED" } });
  const cents = Math.max(0, (b.maxWinners - paid) * b.rewardCents);
  await prisma.submission.updateMany({
    where: { bountyId: id, status: "PENDING" },
    data: { status: "REJECTED", reviewNote: "Bounty was taken down", reviewedAt: new Date() },
  });
  const r = await refundOnChain({ funded: Boolean(b.fundingTxSig), wallet: b.creator.wallet, cents });
  await prisma.bounty.update({
    where: { id },
    data: { status: "REFUNDED", refundTxSig: r.txSig, refundedCents: cents, modNote: note ?? null },
  });
  return { refundedCents: cents, txSig: r.txSig, note: r.note };
}
