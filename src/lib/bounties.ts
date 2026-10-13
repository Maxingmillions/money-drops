import "server-only";
import { prisma } from "./db";
import { ApiError } from "./api";
import { distanceM, type LatLng } from "./geo";
import { shortWallet } from "./drops";
import { devSkipFunding, payout, treasuryKeypair } from "./solana";

export function bountyView(b: {
  id: string; title: string; description: string; rewardLamports: number; lat: number | null; lng: number | null;
  radiusM: number | null; areaName: string | null; deadline: Date | null; maxWinners: number; status: string;
  fundingTxSig: string | null; createdAt: Date; creatorId: string;
  creator: { handle: string | null; wallet: string };
  submissions?: { status: string }[];
}, at?: LatLng | null) {
  const subs = b.submissions ?? [];
  return {
    id: b.id,
    title: b.title,
    description: b.description,
    rewardLamports: b.rewardLamports,
    lat: b.lat,
    lng: b.lng,
    radiusM: b.radiusM,
    areaName: b.areaName,
    deadline: b.deadline?.toISOString() ?? null,
    maxWinners: b.maxWinners,
    status: b.status,
    funded: Boolean(b.fundingTxSig),
    createdAt: b.createdAt.toISOString(),
    creatorId: b.creatorId,
    creator: b.creator.handle ?? shortWallet(b.creator.wallet),
    distanceM: at && b.lat != null && b.lng != null ? distanceM(at, { lat: b.lat, lng: b.lng }) : null,
    pending: subs.filter((s) => s.status === "PENDING").length,
    approved: subs.filter((s) => s.status === "APPROVED").length,
  };
}

/** Approve a submission: mark it, pay the reward, close the bounty when full. */
export async function approveSubmission(submissionId: string, reviewerId: string, note?: string) {
  const sub = await prisma.submission.findUnique({ where: { id: submissionId }, include: { bounty: true, user: true } });
  if (!sub) throw new ApiError(404, "Submission not found");
  if (sub.status !== "PENDING") throw new ApiError(409, "Already reviewed");
  if (sub.bounty.status !== "OPEN") throw new ApiError(409, "Bounty is not open");

  const approvedSoFar = await prisma.submission.count({ where: { bountyId: sub.bountyId, status: "APPROVED" } });
  if (approvedSoFar >= sub.bounty.maxWinners) throw new ApiError(409, "All rewards for this bounty are already awarded");

  await prisma.submission.update({
    where: { id: sub.id },
    data: { status: "APPROVED", reviewerId, reviewNote: note ?? null, reviewedAt: new Date() },
  });

  let payoutStatus = "PENDING";
  let payoutTxSig: string | null = null;
  let payoutError: string | null = null;
  const canPay = Boolean(sub.bounty.fundingTxSig) && Boolean(treasuryKeypair());
  if (canPay) {
    try {
      payoutTxSig = await payout({ recipient: sub.user.wallet, lamports: sub.bounty.rewardLamports });
      payoutStatus = "PAID";
    } catch (e) {
      payoutStatus = "FAILED";
      payoutError = e instanceof Error ? e.message : String(e);
    }
  } else if (!devSkipFunding()) {
    payoutError = "Bounty not funded on-chain or treasury not configured";
  }
  await prisma.submission.update({ where: { id: sub.id }, data: { payoutStatus, payoutTxSig, payoutError } });

  if (approvedSoFar + 1 >= sub.bounty.maxWinners) {
    await prisma.bounty.update({ where: { id: sub.bountyId }, data: { status: "COMPLETED" } });
  }
  return { payoutStatus, payoutTxSig };
}
