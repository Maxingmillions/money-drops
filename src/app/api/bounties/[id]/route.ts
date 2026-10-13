import { prisma } from "@/lib/db";
import { ApiError, handler, json, requireSession } from "@/lib/api";
import { bountyView } from "@/lib/bounties";
import { isMod } from "@/lib/roles";
import { shortWallet } from "@/lib/drops";
import { treasuryAddress } from "@/lib/solana";
import { feeFor, totalWithFee } from "@/lib/pool";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const at = url.searchParams.has("lat") && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;

  const b = await prisma.bounty.findUnique({
    where: { id },
    include: {
      creator: true,
      submissions: { include: { user: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!b) throw new ApiError(404, "Bounty not found");
  const me = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const canReview = isMod(me.role);
  const isCreator = b.creatorId === me.id;

  // Everyone sees counts; creator, mods and the submitter see details.
  const submissions = b.submissions
    .filter((s) => canReview || isCreator || s.userId === me.id)
    .map((s) => ({
      id: s.id,
      user: s.user.handle ?? shortWallet(s.user.wallet),
      mine: s.userId === me.id,
      videoUrl: s.videoUrl,
      files: s.files,
      note: s.note,
      status: s.status,
      reviewNote: s.reviewNote,
      payoutStatus: s.payoutStatus,
      payoutTxSig: s.payoutTxSig,
      createdAt: s.createdAt.toISOString(),
    }));

  return json({
    bounty: bountyView(b, at),
    submissions,
    mine: b.submissions.find((s) => s.userId === me.id)?.status ?? null,
    canReview,
    isCreator,
    funding:
      b.status === "DRAFT" && isCreator
        ? { treasury: treasuryAddress()?.toBase58() ?? null, memo: b.id, lamports: totalWithFee(b.rewardLamports * b.maxWinners), feeLamports: feeFor(b.rewardLamports * b.maxWinners), wallet: me.wallet }
        : null,
  });
});
