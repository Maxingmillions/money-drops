/**
 * Demo content so every screen has something in it. Everything is owned by
 * users with loginMethod = "seed"; `npm run db:unseed` removes it all.
 * Idempotent: re-running skips what already exists.
 */
import { PrismaClient } from "@prisma/client";
import { scatterDrops } from "../src/lib/geo";

const prisma = new PrismaClient();

// Seeded pseudo-random so drop positions are stable between runs.
let seed = 42;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

const SEED_USERS = [
  { wallet: "SeedHanaSui11111111111111111111111111111111", handle: "hana.sui", role: "USER" },
  { wallet: "SeedMaxx1111111111111111111111111111111111", handle: "maxx", role: "USER" },
  { wallet: "SeedPierre111111111111111111111111111111111", handle: "pierre", role: "USER" },
  { wallet: "SeedSolQueen11111111111111111111111111111111", handle: "sol_queen", role: "USER" },
  { wallet: "SeedDegenDan1111111111111111111111111111111", handle: "degen_dan", role: "USER" },
  { wallet: "SeedModRiley1111111111111111111111111111111", handle: "riley (mod)", role: "MOD" },
];

type Hunt = { title: string; areaName: string; lat: number; lng: number; radiusM: number; by: string; tiers: { count: number; amountCents: number }[] };
const HUNTS: Hunt[] = [
  { title: "hana.sui's Tokyo drop", areaName: "Yoyogi Park", lat: 35.6717, lng: 139.6949, radiusM: 600, by: "hana.sui", tiers: [{ count: 30, amountCents: 500 }, { count: 8, amountCents: 5000 }, { count: 2, amountCents: 10000 }] },
  { title: "Central Park Sunday", areaName: "Central Park, NYC", lat: 40.7812, lng: -73.9665, radiusM: 1200, by: "maxx", tiers: [{ count: 40, amountCents: 1000 }, { count: 5, amountCents: 10000 }] },
  { title: "Venice Beach boardwalk", areaName: "Venice Beach, LA", lat: 33.985, lng: -118.4695, radiusM: 700, by: "sol_queen", tiers: [{ count: 25, amountCents: 800 }, { count: 3, amountCents: 20000 }] },
  { title: "Hyde Park hunt", areaName: "Hyde Park, London", lat: 51.5073, lng: -0.1657, radiusM: 900, by: "pierre", tiers: [{ count: 35, amountCents: 500 }, { count: 4, amountCents: 5000 }] },
  { title: "South Beach sprint", areaName: "South Beach, Miami", lat: 25.7826, lng: -80.1341, radiusM: 500, by: "degen_dan", tiers: [{ count: 20, amountCents: 1500 }, { count: 1, amountCents: 50000 }] },
  { title: "Dolores Park drop", areaName: "Mission Dolores Park, SF", lat: 37.7596, lng: -122.4269, radiusM: 350, by: "maxx", tiers: [{ count: 15, amountCents: 2000 }] },
];

const BOUNTIES = [
  { title: "Backflip at the fountain", description: "Film yourself doing a backflip in front of the Yoyogi Park fountain. Face visible, one continuous shot.", rewardCents: 5000, areaName: "Yoyogi Park", lat: 35.6717, lng: 139.6949, radiusM: 200, by: "hana.sui", maxWinners: 1 },
  { title: "Sing happy birthday to a stranger", description: "Approach a stranger in Central Park and sing them a full happy birthday. They must smile by the end.", rewardCents: 2500, areaName: "Central Park, NYC", lat: 40.7812, lng: -73.9665, radiusM: 1500, by: "maxx", maxWinners: 3 },
  { title: "Ice bath in the Atlantic", description: "Full submersion at South Beach before 7am. Show the sunrise and the timestamp.", rewardCents: 10000, areaName: "South Beach, Miami", lat: 25.7826, lng: -80.1341, radiusM: 800, by: "degen_dan", maxWinners: 1 },
  { title: "Street-perform for 10 minutes", description: "Any instrument, any corner of Venice boardwalk. Ten uninterrupted minutes. Bonus points for a crowd.", rewardCents: 7500, areaName: "Venice Beach, LA", lat: 33.985, lng: -118.4695, radiusM: 600, by: "sol_queen", maxWinners: 2 },
  { title: "Explain Solana to your grandma", description: "No location needed. Film a 60-second explanation of what Solana is to someone over 60 and get them to say 'gm' on camera.", rewardCents: 2000, by: "pierre", maxWinners: 5 },
  { title: "Run up the Rocky steps", description: "Philadelphia Museum of Art steps, full sprint, arms up at the top. Film it in one take.", rewardCents: 4000, areaName: "Philadelphia Museum of Art", lat: 39.9656, lng: -75.1810, radiusM: 300, by: "degen_dan", maxWinners: 1 },
];

const CHAT = [
  ["maxx", "gm hunters ☀️"],
  ["hana.sui", "just hid $9,930 across Yoyogi, go get it"],
  ["degen_dan", "wait the $100 ones are real?"],
  ["hana.sui", "yes. 10 of them. good luck"],
  ["sol_queen", "found $50 by the pond in like 4 minutes lol"],
  ["pierre", "London hunt is live in Hyde Park, 39 drops"],
  ["riley (mod)", "reminder: bounty videos need your face visible or we can't approve them"],
  ["degen_dan", "posted the Miami ice bath bounty, $100 to whoever is brave"],
  ["maxx", "the backflip bounty got claimed already?? fast"],
  ["sol_queen", "venice drops are mostly on the boardwalk side, not the sand"],
  ["pierre", "someone in London just took the $50 near the Serpentine"],
  ["riley (mod)", "queue is clear, keep them coming"],
];

async function main() {
  const users = new Map<string, { id: string; wallet: string }>();
  for (const u of SEED_USERS) {
    // Reuse an existing user with this handle (older seeds used other wallets).
    const byHandle = await prisma.user.findUnique({ where: { handle: u.handle } });
    const row = byHandle
      ? await prisma.user.update({ where: { id: byHandle.id }, data: { role: u.role, loginMethod: "seed" } })
      : await prisma.user.upsert({
          where: { wallet: u.wallet },
          update: { handle: u.handle, role: u.role, loginMethod: "seed" },
          create: { wallet: u.wallet, handle: u.handle, role: u.role, loginMethod: "seed" },
        });
    users.set(u.handle, row);
  }
  const by = (h: string) => users.get(h)!;

  // Hunts (campaigns) with drops; a few drops already claimed by other seed users.
  for (const h of HUNTS) {
    const exists = await prisma.campaign.findFirst({ where: { creatorId: by(h.by).id, title: h.title } });
    if (exists) continue;
    const totalCents = h.tiers.reduce((s, t) => s + t.count * t.amountCents, 0);
    const campaign = await prisma.campaign.create({
      data: {
        creatorId: by(h.by).id,
        title: h.title,
        kind: "PROXIMITY",
        status: "ACTIVE",
        totalCents,
        perPersonLimit: 1,
        searchRadiusM: 80,
        centerLat: h.lat,
        centerLng: h.lng,
        radiusM: h.radiusM,
        areaName: h.areaName,
        fundedAt: new Date(),
      },
    });
    const drops = scatterDrops({ centerLat: h.lat, centerLng: h.lng, radiusM: h.radiusM }, h.tiers, rand).map((d) => ({ ...d, campaignId: campaign.id }));
    await prisma.drop.createMany({ data: drops });
    // Claim ~15% of the cheap drops by other seed users for realistic stats.
    const created = await prisma.drop.findMany({ where: { campaignId: campaign.id }, orderBy: { amountCents: "asc" } });
    const claimers = SEED_USERS.filter((u) => u.handle !== h.by && u.role === "USER");
    for (let i = 0; i < Math.floor(created.length * 0.15); i++) {
      const d = created[i];
      const c = by(claimers[i % claimers.length].handle);
      const already = await prisma.claim.findFirst({ where: { campaignId: campaign.id, userId: c.id } });
      if (already) continue;
      await prisma.drop.update({ where: { id: d.id }, data: { status: "CLAIMED" } });
      await prisma.claim.create({
        data: { dropId: d.id, campaignId: campaign.id, userId: c.id, amountCents: d.amountCents, lat: d.lat, lng: d.lng, distanceM: 3 + rand() * 8, payoutStatus: "PAID", payoutTxSig: null, createdAt: new Date(Date.now() - rand() * 5 * 86_400_000) },
      });
    }
    console.log(`hunt: ${h.title} (${drops.length} drops)`);
  }

  // Bounties with a mix of submissions.
  const mod = by("riley (mod)");
  for (const [i, b] of BOUNTIES.entries()) {
    const exists = await prisma.bounty.findFirst({ where: { creatorId: by(b.by).id, title: b.title } });
    if (exists) continue;
    const bounty = await prisma.bounty.create({
      data: {
        creatorId: by(b.by).id,
        title: b.title,
        description: b.description,
        rewardCents: b.rewardCents,
        maxWinners: b.maxWinners,
        lat: b.lat ?? null,
        lng: b.lng ?? null,
        radiusM: b.lat != null ? b.radiusM ?? 200 : null,
        areaName: b.areaName ?? null,
        status: "OPEN",
        fundedAt: new Date(),
        deadline: i % 2 === 0 ? new Date(Date.now() + (7 + i) * 86_400_000) : null,
        createdAt: new Date(Date.now() - (i + 1) * 36 * 3_600_000),
      },
    });
    const others = SEED_USERS.filter((u) => u.handle !== b.by && u.role === "USER");
    // First bounty: one approved (paid) submission → completed.
    if (i === 0) {
      await prisma.submission.create({
        data: { bountyId: bounty.id, userId: by(others[0].handle).id, videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", note: "Landed it on the second try 🤸", status: "APPROVED", reviewerId: mod.id, reviewNote: "Clean flip, face visible. Paid.", reviewedAt: new Date(), payoutStatus: "PAID" },
      });
      await prisma.bounty.update({ where: { id: bounty.id }, data: { status: "COMPLETED" } });
    }
    // Others: a pending submission or two, one rejected.
    if (i === 1 || i === 3 || i === 4) {
      await prisma.submission.create({
        data: { bountyId: bounty.id, userId: by(others[1].handle).id, videoUrl: "https://www.tiktok.com/@drops/video/7301234567890123456", note: "Full clip, she laughed at the end", status: "PENDING" },
      });
    }
    if (i === 1) {
      await prisma.submission.create({
        data: { bountyId: bounty.id, userId: by(others[2].handle).id, videoUrl: "https://x.com/drops/status/1700000000000000000", note: "cut the first 5 seconds sorry", status: "REJECTED", reviewerId: mod.id, reviewNote: "Video starts mid-song, we need the whole thing.", reviewedAt: new Date() },
      });
    }
    console.log(`bounty: ${b.title}`);
  }

  // Chat history.
  const existing = await prisma.message.count({ where: { user: { loginMethod: "seed" } } });
  if (existing === 0) {
    let t = Date.now() - CHAT.length * 7 * 60_000;
    for (const [handle, body] of CHAT) {
      await prisma.message.create({ data: { room: "global", userId: by(handle).id, body, createdAt: new Date(t) } });
      t += 7 * 60_000 + rand() * 60_000;
    }
    console.log(`chat: ${CHAT.length} messages`);
  }
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
