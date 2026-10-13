import { prisma } from "@/lib/db";
import { handler, json, requireSession } from "@/lib/api";
import { requireMod } from "@/lib/roles";
import { shortWallet } from "@/lib/drops";

/** Review queue: pending submissions across all open bounties. */
export const GET = handler(async () => {
  const session = await requireSession();
  await requireMod(session);
  const rows = await prisma.submission.findMany({
    where: { status: "PENDING", bounty: { status: "OPEN" } },
    include: { user: true, bounty: { include: { creator: true } } },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  return json({
    queue: rows.map((s) => ({
      id: s.id,
      videoUrl: s.videoUrl,
      note: s.note,
      createdAt: s.createdAt.toISOString(),
      user: s.user.handle ?? shortWallet(s.user.wallet),
      bounty: {
        id: s.bounty.id,
        title: s.bounty.title,
        rewardCents: s.bounty.rewardCents,
        areaName: s.bounty.areaName,
        creator: s.bounty.creator.handle ?? shortWallet(s.bounty.creator.wallet),
      },
    })),
  });
});
