import { prisma } from "@/lib/db";
import { ApiError, handler, json, requireSession } from "@/lib/api";
import { campaignStats } from "@/lib/drops";
import { treasuryAddress } from "@/lib/solana";
import { feeFor, totalWithFee } from "@/lib/pool";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (_req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const c = await prisma.campaign.findUnique({
    where: { id },
    include: { drops: { select: { amountLamports: true, status: true, lat: true, lng: true } } },
  });
  if (!c) throw new ApiError(404, "Campaign not found");
  if (c.creatorId !== session.userId) throw new ApiError(403, "Not your campaign");

  const stats = (await campaignStats([id])).get(id)!;
  const claimedLamports = c.drops.filter((d) => d.status === "CLAIMED").reduce((s, d) => s + d.amountLamports, 0);
  const tiers = new Map<number, { count: number; remaining: number }>();
  for (const d of c.drops) {
    const t = tiers.get(d.amountLamports) ?? { count: 0, remaining: 0 };
    t.count++;
    if (d.status === "HIDDEN") t.remaining++;
    tiers.set(d.amountLamports, t);
  }

  return json({
    campaign: {
      id: c.id,
      title: c.title,
      kind: c.kind,
      status: c.status,
      totalLamports: c.totalLamports,
      claimedLamports,
      perPersonLimit: c.perPersonLimit,
      centerLat: c.centerLat,
      centerLng: c.centerLng,
      radiusM: c.radiusM,
      areaName: c.areaName,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      fundingTxSig: c.fundingTxSig,
      fundedAt: c.fundedAt,
      refundedLamports: c.refundedLamports ?? 0,
      refundTxSig: c.refundTxSig,
      dropCount: c.drops.length,
      ...stats,
      tiers: [...tiers.entries()]
        .map(([amountLamports, t]) => ({ amountLamports, ...t }))
        .sort((a, b) => a.amountLamports - b.amountLamports),
      // Creators see their own drop locations.
      drops: c.drops,
    },
    funding:
      c.status === "DRAFT"
        ? { treasury: treasuryAddress()?.toBase58() ?? null, memo: c.id, lamports: totalWithFee(c.totalLamports), feeLamports: feeFor(c.totalLamports), wallet: session.wallet }
        : null,
  });
});
