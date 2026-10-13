/**
 * Removes ALL content (hunts, drops, claims, bounties, submissions, chat, pool
 * history) and resets the fee pool to zero. Accounts are kept.
 *
 *   npm run db:wipe
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [claims, drops, campaigns, submissions, bounties, messages, events] = await prisma.$transaction([
    prisma.claim.deleteMany(),
    prisma.drop.deleteMany(),
    prisma.campaign.deleteMany(),
    prisma.submission.deleteMany(),
    prisma.bounty.deleteMany(),
    prisma.message.deleteMany(),
    prisma.poolEvent.deleteMany(),
  ]);
  await prisma.pool.updateMany({
    data: { balanceLamports: 0, feesCollectedLamports: 0, poolCollectedLamports: 0, droppedLamports: 0, runs: 0, lastRunAt: null },
  });
  const seedUsers = await prisma.user.deleteMany({ where: { loginMethod: "seed" } });
  console.log(
    `Wiped ${campaigns.count} hunts, ${drops.count} drops, ${claims.count} claims, ${bounties.count} bounties, ${submissions.count} submissions, ${messages.count} messages, ${events.count} pool events, ${seedUsers.count} demo accounts. Pool reset to 0.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
