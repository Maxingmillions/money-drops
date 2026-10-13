import { prisma } from "@/lib/db";
import { handler, json, requireSession } from "@/lib/api";
import { requireMod } from "@/lib/roles";
import { shortWallet } from "@/lib/drops";

/** Everything a mod can act on: live drop campaigns and bounties. */
export const GET = handler(async () => {
  const session = await requireSession();
  const me = await requireMod(session);
  const [campaigns, bounties, team] = await Promise.all([
    prisma.campaign.findMany({
      where: { status: { in: ["ACTIVE", "DRAFT", "ENDED"] } },
      include: { creator: true, drops: { select: { status: true, amountLamports: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.bounty.findMany({
      where: { status: { in: ["OPEN", "DRAFT", "COMPLETED"] } },
      include: { creator: true, submissions: { select: { status: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.user.findMany({ where: { role: { in: ["MOD", "ADMIN"] } }, orderBy: { createdAt: "asc" } }),
  ]);
  return json({
    me: { role: me.role },
    campaigns: campaigns.map((c) => ({
      id: c.id,
      title: c.title,
      creator: c.creator.handle ?? shortWallet(c.creator.wallet),
      status: c.status,
      totalLamports: c.totalLamports,
      remainingLamports: c.drops.filter((d) => d.status === "HIDDEN").reduce((s, d) => s + d.amountLamports, 0),
      remaining: c.drops.filter((d) => d.status === "HIDDEN").length,
      dropCount: c.drops.length,
      areaName: c.areaName,
      funded: Boolean(c.fundingTxSig),
      createdAt: c.createdAt.toISOString(),
    })),
    bounties: bounties.map((b) => ({
      id: b.id,
      title: b.title,
      creator: b.creator.handle ?? shortWallet(b.creator.wallet),
      status: b.status,
      rewardLamports: b.rewardLamports,
      maxWinners: b.maxWinners,
      approved: b.submissions.filter((s) => s.status === "APPROVED").length,
      pending: b.submissions.filter((s) => s.status === "PENDING").length,
      areaName: b.areaName,
      funded: Boolean(b.fundingTxSig),
      createdAt: b.createdAt.toISOString(),
    })),
    team: team.map((u) => ({ id: u.id, wallet: u.wallet, handle: u.handle, role: u.role })),
  });
});
