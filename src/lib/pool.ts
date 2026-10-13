import "server-only";
import { prisma } from "./db";
import { scatterDrops, type LatLng } from "./geo";
import { METROS, pickMetro } from "./metros";

/** Platform fee in basis points on every funded hunt / bounty (500 = 5%). */
export const FEE_BPS = Number(process.env.FEE_BPS ?? 500);
/** Share of the fee that goes into the community drop pool (5000 = 50%). */
export const POOL_SHARE_BPS = Number(process.env.POOL_SHARE_BPS ?? 5000);
/** Pool drops run at most this often. */
export const POOL_INTERVAL_MS = 15 * 60_000;
const MIN_DROP = 1_000_000; // 0.001 SOL
const TARGET_DROP = 5_000_000; // 0.005 SOL
const MAX_DROPS_PER_RUN = 10;
const RUN_SHARE = 0.25; // spend up to a quarter of the pool per run
const RADIUS_M = 4800; // ~3 miles

export const feeFor = (lamports: number) => Math.round((lamports * FEE_BPS) / 10_000);
export const poolShareOf = (fee: number) => Math.round((fee * POOL_SHARE_BPS) / 10_000);
/** What a funder pays: the post amount plus the platform fee. */
export const totalWithFee = (lamports: number) => lamports + feeFor(lamports);

async function pool() {
  return prisma.pool.upsert({ where: { id: "main" }, update: {}, create: { id: "main" } });
}

/** Record the fee on a funded post and credit half of it to the pool. */
export async function collectFee(opts: { lamports: number; source: string; onChain: boolean }) {
  const fee = feeFor(opts.lamports);
  const toPool = poolShareOf(fee);
  await pool();
  await prisma.$transaction([
    prisma.pool.update({
      where: { id: "main" },
      data: {
        balanceLamports: { increment: toPool },
        feesCollectedLamports: { increment: fee },
        poolCollectedLamports: { increment: toPool },
      },
    }),
    prisma.poolEvent.create({ data: { kind: "FEE", lamports: fee, poolLamports: toPool, source: opts.source, onChain: opts.onChain } }),
  ]);
  return { fee, toPool };
}

/**
 * Where to drop: half the time a major metro (weighted by population), the
 * other half somewhere people are active right now (recent positions, then
 * live hunt centres). Either way the drop lands within a few miles.
 */
async function populatedAreas(): Promise<{ center: LatLng; name: string | null }[]> {
  const metro = pickMetro();
  const metroArea = { center: { lat: metro.lat, lng: metro.lng }, name: metro.name };
  if (Math.random() < 0.5) return [metroArea];

  const since = new Date(Date.now() - 48 * 3_600_000);
  const users = await prisma.user.findMany({
    where: { lastSeenAt: { gte: since }, lastLat: { not: null }, lastLng: { not: null }, loginMethod: { not: "system" } },
    select: { lastLat: true, lastLng: true },
    take: 500,
  });
  const areas = users.map((u) => ({ center: { lat: u.lastLat!, lng: u.lastLng! }, name: null as string | null }));
  if (areas.length > 0) return areas;
  const hunts = await prisma.campaign.findMany({
    where: { status: "ACTIVE", creator: { loginMethod: { not: "system" } } },
    select: { centerLat: true, centerLng: true, areaName: true },
    take: 200,
  });
  if (hunts.length > 0) return hunts.map((h) => ({ center: { lat: h.centerLat, lng: h.centerLng }, name: h.areaName }));
  return [metroArea];
}

function nearestMetroName(p: LatLng): string | null {
  let best: { name: string; d: number } | null = null;
  for (const m of METROS) {
    const d = (m.lat - p.lat) ** 2 + (m.lng - p.lng) ** 2;
    if (!best || d < best.d) best = { name: m.name, d };
  }
  // Only label it when it's actually close (~1.5 degrees).
  return best && best.d < 2.25 ? `near ${best.name}` : null;
}

async function systemUser() {
  return prisma.user.upsert({
    where: { wallet: "DropsPool1111111111111111111111111111111111" },
    update: {},
    create: { wallet: "DropsPool1111111111111111111111111111111111", handle: "drops.pool", loginMethod: "system" },
  });
}

/**
 * Lazy scheduler: called from hot API routes. Claims the run with a DB
 * update so only one request every 15 minutes actually drops money.
 */
export async function maybeRunPoolDrops() {
  const cutoff = new Date(Date.now() - POOL_INTERVAL_MS);
  await pool();
  const claimed = await prisma.pool.updateMany({
    where: { id: "main", OR: [{ lastRunAt: null }, { lastRunAt: { lt: cutoff } }] },
    data: { lastRunAt: new Date() },
  });
  if (claimed.count === 0) return null;
  return runPoolDrop();
}

export async function runPoolDrop() {
  const p = await pool();
  const budget = Math.min(Math.floor(p.balanceLamports * RUN_SHARE), TARGET_DROP * MAX_DROPS_PER_RUN);
  if (budget < MIN_DROP) {
    await prisma.pool.update({ where: { id: "main" }, data: { runs: { increment: 1 } } });
    return { dropped: 0, reason: "pool too small" };
  }
  const areas = await populatedAreas();
  if (areas.length === 0) {
    await prisma.pool.update({ where: { id: "main" }, data: { runs: { increment: 1 } } });
    return { dropped: 0, reason: "nobody around yet" };
  }
  const area = areas[Math.floor(Math.random() * areas.length)];
  if (!area.name) area.name = nearestMetroName(area.center);
  const count = Math.max(1, Math.min(MAX_DROPS_PER_RUN, Math.floor(budget / TARGET_DROP)));
  const per = Math.floor(budget / count);
  const total = per * count;
  const sys = await systemUser();

  const campaign = await prisma.campaign.create({
    data: {
      creatorId: sys.id,
      title: area.name ? `Pool drop · ${area.name}` : "Pool drop",
      kind: "PROXIMITY",
      status: "ACTIVE",
      totalLamports: total,
      perPersonLimit: 1,
      searchRadiusM: 150,
      revealRadiusM: 30,
      centerLat: area.center.lat,
      centerLng: area.center.lng,
      radiusM: RADIUS_M,
      areaName: area.name ?? "Near you",
      fundedAt: new Date(),
    },
  });
  const drops = scatterDrops({ centerLat: area.center.lat, centerLng: area.center.lng, radiusM: RADIUS_M }, [{ count, amountLamports: per }]).map((d) => ({ ...d, campaignId: campaign.id }));
  await prisma.drop.createMany({ data: drops });
  await prisma.$transaction([
    prisma.pool.update({ where: { id: "main" }, data: { balanceLamports: { decrement: total }, droppedLamports: { increment: total }, runs: { increment: 1 } } }),
    prisma.poolEvent.create({ data: { kind: "DROP", lamports: total, poolLamports: total, campaignId: campaign.id, areaName: area.name ?? "Near you" } }),
  ]);
  return { dropped: total, count, campaignId: campaign.id };
}

export async function poolSummary() {
  const p = await pool();
  const events = await prisma.poolEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12 });
  const nextRunAt = p.lastRunAt ? new Date(p.lastRunAt.getTime() + POOL_INTERVAL_MS) : new Date();
  return {
    feeBps: FEE_BPS,
    poolShareBps: POOL_SHARE_BPS,
    balanceLamports: p.balanceLamports,
    feesCollectedLamports: p.feesCollectedLamports,
    poolCollectedLamports: p.poolCollectedLamports,
    droppedLamports: p.droppedLamports,
    runs: p.runs,
    lastRunAt: p.lastRunAt?.toISOString() ?? null,
    nextRunAt: nextRunAt.toISOString(),
    intervalMs: POOL_INTERVAL_MS,
    events: events.map((e) => ({ id: e.id, kind: e.kind, lamports: e.lamports, poolLamports: e.poolLamports, areaName: e.areaName, campaignId: e.campaignId, onChain: e.onChain, createdAt: e.createdAt.toISOString() })),
  };
}
