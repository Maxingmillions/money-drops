import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handler, json, parseBody, requireSession } from "@/lib/api";
import { bountyView } from "@/lib/bounties";
import { devSkipFunding, treasuryAddress } from "@/lib/solana";

const Body = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().min(10).max(2000),
  rewardCents: z.number().int().min(100).max(10_000_000),
  maxWinners: z.number().int().min(1).max(100).default(1),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  radiusM: z.number().int().min(20).max(50_000).optional(),
  areaName: z.string().trim().max(80).optional(),
  deadline: z.string().datetime().optional(),
});

export const POST = handler(async (req) => {
  const session = await requireSession();
  const body = await parseBody(req, Body);
  if ((body.lat == null) !== (body.lng == null)) throw new ApiError(400, "Location needs both lat and lng");
  const skip = devSkipFunding();
  const bounty = await prisma.bounty.create({
    data: {
      creatorId: session.userId,
      title: body.title,
      description: body.description,
      rewardCents: body.rewardCents,
      maxWinners: body.maxWinners,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      radiusM: body.lat != null ? (body.radiusM ?? 200) : null,
      areaName: body.areaName || null,
      deadline: body.deadline ? new Date(body.deadline) : null,
      status: skip ? "OPEN" : "DRAFT",
      fundedAt: skip ? new Date() : null,
    },
  });
  const totalCents = body.rewardCents * body.maxWinners;
  return json({
    bounty: { id: bounty.id, status: bounty.status },
    funding: skip ? null : { treasury: treasuryAddress()?.toBase58() ?? null, memo: bounty.id, amountCents: totalCents },
  });
});

export const GET = handler(async (req) => {
  await requireSession();
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const at = url.searchParams.has("lat") && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  const mine = url.searchParams.get("mine") === "1";
  const session = await requireSession();
  const rows = await prisma.bounty.findMany({
    where: mine ? { creatorId: session.userId } : { status: { in: ["OPEN", "COMPLETED"] } },
    include: { creator: true, submissions: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const bounties = rows.map((b) => bountyView(b, at));
  if (at) bounties.sort((a, b) => (a.distanceM ?? 1e12) - (b.distanceM ?? 1e12));
  return json({ bounties });
});
