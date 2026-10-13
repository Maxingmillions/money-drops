import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handler, json, parseBody, requireSession } from "@/lib/api";
import { scatterDrops } from "@/lib/geo";
import { devSkipFunding, treasuryAddress } from "@/lib/solana";

const Body = z.object({
  title: z.string().trim().min(2).max(60),
  kind: z.enum(["PROXIMITY", "EVENT"]),
  tiers: z
    .array(z.object({ count: z.number().int().min(1).max(5000), amountCents: z.number().int().min(100).max(1_000_000) }))
    .min(1)
    .max(5),
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  radiusM: z.number().int().min(50).max(5000),
  areaName: z.string().trim().max(60).optional(),
  perPersonLimit: z.number().int().min(1).max(100).default(1),
  searchRadiusM: z.number().int().min(40).max(500).default(80),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export const POST = handler(async (req) => {
  const session = await requireSession();
  const body = await parseBody(req, Body);

  const dropCount = body.tiers.reduce((s, t) => s + t.count, 0);
  if (dropCount > 5000) throw new ApiError(400, "Too many drops in one campaign (max 5,000)");
  const totalCents = body.tiers.reduce((s, t) => s + t.count * t.amountCents, 0);

  if (body.kind === "EVENT") {
    if (!body.startsAt || !body.endsAt) throw new ApiError(400, "Event drops need a start and end time");
    if (new Date(body.endsAt) <= new Date(body.startsAt)) throw new ApiError(400, "End must be after start");
  }

  const skip = devSkipFunding();
  const campaign = await prisma.campaign.create({
    data: {
      creatorId: session.userId,
      title: body.title,
      kind: body.kind,
      status: skip ? "ACTIVE" : "DRAFT",
      totalCents,
      perPersonLimit: body.perPersonLimit,
      searchRadiusM: body.searchRadiusM,
      centerLat: body.centerLat,
      centerLng: body.centerLng,
      radiusM: body.radiusM,
      areaName: body.areaName || null,
      startsAt: body.startsAt ? new Date(body.startsAt) : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      fundedAt: skip ? new Date() : null,
    },
  });
  const drops = scatterDrops(
    { centerLat: body.centerLat, centerLng: body.centerLng, radiusM: body.radiusM },
    body.tiers,
  ).map((d) => ({ ...d, campaignId: campaign.id }));
  await prisma.drop.createMany({ data: drops });

  return json({
    campaign: { id: campaign.id, status: campaign.status, totalCents, dropCount: drops.length },
    funding: skip
      ? null
      : { treasury: treasuryAddress()?.toBase58() ?? null, memo: campaign.id, amountCents: totalCents },
  });
});

export const GET = handler(async () => {
  const session = await requireSession();
  const campaigns = await prisma.campaign.findMany({
    where: { creatorId: session.userId },
    orderBy: { createdAt: "desc" },
  });
  return json({ campaigns });
});
