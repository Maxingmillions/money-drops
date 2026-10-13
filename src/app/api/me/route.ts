import { prisma } from "@/lib/db";
import { handler, json, requireSession } from "@/lib/api";
import { campaignStats } from "@/lib/drops";

export const GET = handler(async () => {
  const session = await requireSession();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });

  const claims = await prisma.claim.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { campaign: { select: { title: true, areaName: true } } },
    take: 50,
  });
  const campaigns = await prisma.campaign.findMany({
    where: { creatorId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const stats = await campaignStats(campaigns.map((c) => c.id));

  const foundCents = claims.reduce((s, c) => s + c.amountCents, 0);
  const paidCents = claims
    .filter((c) => c.payoutStatus === "PAID")
    .reduce((s, c) => s + c.amountCents, 0);

  return json({
    user: { id: user.id, wallet: user.wallet, handle: user.handle, role: user.role },
    totals: { foundCents, paidCents, pendingCents: foundCents - paidCents, drops: claims.length },
    claims: claims.map((c) => ({
      id: c.id,
      amountCents: c.amountCents,
      payoutStatus: c.payoutStatus,
      payoutTxSig: c.payoutTxSig,
      createdAt: c.createdAt,
      campaignTitle: c.campaign.title,
      areaName: c.campaign.areaName,
    })),
    campaigns: campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      kind: c.kind,
      status: c.status,
      totalCents: c.totalCents,
      areaName: c.areaName,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      createdAt: c.createdAt,
      ...(stats.get(c.id) ?? { remaining: 0, bigRemaining: 0, bigTotal: 0 }),
    })),
  });
});
