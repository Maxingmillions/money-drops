/** Removes everything created by prisma/seed.ts (owned by loginMethod = "seed" users). */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const seedUsers = await prisma.user.findMany({ where: { loginMethod: "seed" }, select: { id: true } });
  const ids = seedUsers.map((u) => u.id);
  if (ids.length === 0) {
    console.log("No seed users found; nothing to remove.");
    return;
  }
  const campaigns = await prisma.campaign.findMany({ where: { creatorId: { in: ids } }, select: { id: true } });
  const cids = campaigns.map((c) => c.id);
  const bounties = await prisma.bounty.findMany({ where: { creatorId: { in: ids } }, select: { id: true } });
  const bids = bounties.map((b) => b.id);

  const r1 = await prisma.claim.deleteMany({ where: { OR: [{ campaignId: { in: cids } }, { userId: { in: ids } }] } });
  const r2 = await prisma.drop.deleteMany({ where: { campaignId: { in: cids } } });
  const r3 = await prisma.campaign.deleteMany({ where: { id: { in: cids } } });
  const r4 = await prisma.submission.deleteMany({ where: { OR: [{ bountyId: { in: bids } }, { userId: { in: ids } }, { reviewerId: { in: ids } }] } });
  const r5 = await prisma.bounty.deleteMany({ where: { id: { in: bids } } });
  const r6 = await prisma.message.deleteMany({ where: { userId: { in: ids } } });
  const r7 = await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`Removed ${r3.count} hunts, ${r2.count} drops, ${r1.count} claims, ${r5.count} bounties, ${r4.count} submissions, ${r6.count} messages, ${r7.count} seed users.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
