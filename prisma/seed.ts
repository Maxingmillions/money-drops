import { PrismaClient } from "@prisma/client";
import { scatterDrops } from "../src/lib/geo";

const prisma = new PrismaClient();

// Seed a demo campaign around SEED_LAT/SEED_LNG (default: Yoyogi Park, Tokyo,
// matching the concept video). Point it at your own neighbourhood to test.
const centerLat = Number(process.env.SEED_LAT ?? 35.6717);
const centerLng = Number(process.env.SEED_LNG ?? 139.6949);

async function main() {
  const creator = await prisma.user.upsert({
    where: { wallet: "DemoCreator1111111111111111111111111111111" },
    update: {},
    create: {
      wallet: "DemoCreator1111111111111111111111111111111",
      handle: "hana.sui",
    },
  });

  const existing = await prisma.campaign.findFirst({
    where: { creatorId: creator.id, title: "hana.sui's Tokyo drop" },
  });
  if (existing) {
    console.log("Seed campaign already exists, skipping.");
    return;
  }

  const tiers = [
    { count: 30, amountCents: 500 },
    { count: 8, amountCents: 5000 },
    { count: 2, amountCents: 10000 },
  ];
  const totalCents = tiers.reduce((s, t) => s + t.count * t.amountCents, 0);

  const campaign = await prisma.campaign.create({
    data: {
      creatorId: creator.id,
      title: "hana.sui's Tokyo drop",
      kind: "PROXIMITY",
      status: "ACTIVE",
      totalCents,
      perPersonLimit: 1,
      centerLat,
      centerLng,
      radiusM: 600,
      areaName: "Yoyogi Park",
      fundedAt: new Date(),
    },
  });

  const drops = scatterDrops({ centerLat, centerLng, radiusM: 600 }, tiers).map(
    (d) => ({ ...d, campaignId: campaign.id }),
  );
  await prisma.drop.createMany({ data: drops });

  console.log(
    `Seeded campaign ${campaign.id} with ${drops.length} drops around ${centerLat},${centerLng}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
