import "server-only";
import { prisma } from "./db";
import { ApiError } from "./api";
import { boundingBox, distanceM, fuzzPosition, type LatLng } from "./geo";
import { devSkipFunding, payout, treasuryKeypair } from "./solana";

export type PublicDrop = {
  id: string;
  amountCents: number;
  lat: number;
  lng: number;
  /** true when lat/lng is the real spot (hunter is inside revealRadius). */
  exact: boolean;
  distanceM: number;
  campaign: {
    id: string;
    title: string;
    kind: string;
    creator: string;
    areaName: string | null;
    searchRadiusM: number;
    revealRadiusM: number;
    claimRadiusM: number;
    endsAt: string | null;
    remaining: number;
    bigRemaining: number;
    bigTotal: number;
    totalCents: number;
  };
};

function campaignIsLive(c: { status: string; kind: string; startsAt: Date | null; endsAt: Date | null }, now = new Date()) {
  if (c.status !== "ACTIVE") return false;
  if (c.kind === "EVENT") {
    if (c.startsAt && now < c.startsAt) return false;
    if (c.endsAt && now > c.endsAt) return false;
  }
  return true;
}

/**
 * Hidden drops within `radiusM` of `at` (the map viewport centre). Distances
 * and reveals are computed from `user` (the hunter's real position) when
 * given, so panning the map never leaks exact spots.
 */
export async function nearbyDrops(at: LatLng, radiusM: number, user: LatLng | null = at): Promise<PublicDrop[]> {
  const box = boundingBox(at, radiusM);
  const drops = await prisma.drop.findMany({
    where: {
      status: "HIDDEN",
      lat: { gte: box.minLat, lte: box.maxLat },
      lng: { gte: box.minLng, lte: box.maxLng },
      campaign: { status: "ACTIVE" },
    },
    include: { campaign: { include: { creator: true } } },
    take: 500,
  });

  const now = new Date();
  const live = drops.filter((d) => campaignIsLive(d.campaign, now));
  const campaignIds = [...new Set(live.map((d) => d.campaignId))];
  const stats = await campaignStats(campaignIds);

  return live
    .map((d) => {
      const dist = user ? distanceM(user, d) : Number.POSITIVE_INFINITY;
      const exact = user ? dist <= d.campaign.revealRadiusM : false;
      const pos = exact ? { lat: d.lat, lng: d.lng } : fuzzPosition(d.id, d, d.campaign.searchRadiusM, d.campaign.revealRadiusM);
      const s = stats.get(d.campaignId)!;
      return {
        id: d.id,
        amountCents: d.amountCents,
        lat: pos.lat,
        lng: pos.lng,
        exact,
        distanceM: dist,
        campaign: {
          id: d.campaign.id,
          title: d.campaign.title,
          kind: d.campaign.kind,
          creator: d.campaign.creator.handle ?? shortWallet(d.campaign.creator.wallet),
          areaName: d.campaign.areaName,
          searchRadiusM: d.campaign.searchRadiusM,
          revealRadiusM: d.campaign.revealRadiusM,
          claimRadiusM: d.campaign.claimRadiusM,
          endsAt: d.campaign.endsAt?.toISOString() ?? null,
          totalCents: d.campaign.totalCents,
          ...s,
        },
      };
    })
    .filter((d) => distanceM(at, { lat: d.lat, lng: d.lng }) <= radiusM * 1.2)
    .sort((a, b) => a.distanceM - b.distanceM);
}

/** One bubble per live campaign for the zoomed-out world view. */
export async function campaignOverview() {
  const campaigns = await prisma.campaign.findMany({
    where: { status: "ACTIVE" },
    include: { creator: true, drops: { select: { status: true, amountCents: true } } },
  });
  const now = new Date();
  return campaigns
    .filter((c) => campaignIsLive(c, now))
    .map((c) => {
      const hidden = c.drops.filter((d) => d.status === "HIDDEN");
      return {
        id: c.id,
        title: c.title,
        areaName: c.areaName,
        creator: c.creator.handle ?? shortWallet(c.creator.wallet),
        lat: c.centerLat,
        lng: c.centerLng,
        radiusM: c.radiusM,
        remaining: hidden.length,
        remainingCents: hidden.reduce((s, d) => s + d.amountCents, 0),
      };
    })
    .filter((c) => c.remaining > 0);
}

export async function campaignStats(campaignIds: string[]) {
  const map = new Map<string, { remaining: number; bigRemaining: number; bigTotal: number }>();
  if (campaignIds.length === 0) return map;
  const rows = await prisma.drop.findMany({
    where: { campaignId: { in: campaignIds } },
    select: { campaignId: true, amountCents: true, status: true },
  });
  const byCampaign = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byCampaign.get(r.campaignId) ?? [];
    list.push(r);
    byCampaign.set(r.campaignId, list);
  }
  for (const [id, list] of byCampaign) {
    const maxAmount = Math.max(...list.map((r) => r.amountCents));
    const big = list.filter((r) => r.amountCents === maxAmount);
    map.set(id, {
      remaining: list.filter((r) => r.status === "HIDDEN").length,
      bigRemaining: big.filter((r) => r.status === "HIDDEN").length,
      bigTotal: big.length,
    });
  }
  return map;
}

export function shortWallet(w: string) {
  return `${w.slice(0, 4)}…${w.slice(-4)}`;
}

export async function dropForHunter(dropId: string, at: LatLng | null): Promise<PublicDrop> {
  const d = await prisma.drop.findUnique({
    where: { id: dropId },
    include: { campaign: { include: { creator: true } } },
  });
  if (!d) throw new ApiError(404, "Drop not found");
  const s = (await campaignStats([d.campaignId])).get(d.campaignId)!;
  const dist = at ? distanceM(at, d) : Number.POSITIVE_INFINITY;
  const exact = at ? dist <= d.campaign.revealRadiusM : false;
  const pos = exact ? { lat: d.lat, lng: d.lng } : fuzzPosition(d.id, d, d.campaign.searchRadiusM, d.campaign.revealRadiusM);
  return {
    id: d.id,
    amountCents: d.amountCents,
    lat: pos.lat,
    lng: pos.lng,
    exact,
    distanceM: dist,
    campaign: {
      id: d.campaign.id,
      title: d.campaign.title,
      kind: d.campaign.kind,
      creator: d.campaign.creator.handle ?? shortWallet(d.campaign.creator.wallet),
      areaName: d.campaign.areaName,
      searchRadiusM: d.campaign.searchRadiusM,
      revealRadiusM: d.campaign.revealRadiusM,
      claimRadiusM: d.campaign.claimRadiusM,
      endsAt: d.campaign.endsAt?.toISOString() ?? null,
      totalCents: d.campaign.totalCents,
      ...s,
    },
  };
}

/**
 * Claim a drop. Validates liveness, per-person limit and distance, flips the
 * drop to CLAIMED atomically, records the claim, then attempts the USDC payout.
 */
export async function claimDrop(opts: {
  dropId: string;
  userId: string;
  wallet: string;
  at: LatLng;
  accuracyM?: number;
}) {
  const started = Date.now();
  const drop = await prisma.drop.findUnique({
    where: { id: opts.dropId },
    include: { campaign: true },
  });
  if (!drop) throw new ApiError(404, "Drop not found");
  if (drop.status !== "HIDDEN") throw new ApiError(409, "Someone already found this drop");
  if (!campaignIsLive(drop.campaign)) throw new ApiError(409, "This drop isn't claimable right now");

  const already = await prisma.claim.count({
    where: { campaignId: drop.campaignId, userId: opts.userId },
  });
  if (already >= drop.campaign.perPersonLimit) {
    throw new ApiError(403, "You've already claimed your drop from this hunt");
  }

  const dist = distanceM(opts.at, drop);
  // Allow a little GPS slack, capped so a wildly inaccurate fix can't claim from afar.
  const slack = Math.min(opts.accuracyM ?? 0, 20);
  if (dist > drop.campaign.claimRadiusM + slack) {
    throw new ApiError(
      403,
      `You're ${Math.round(dist)} m away. Get within ${drop.campaign.claimRadiusM} m to claim.`,
    );
  }

  // Atomic flip guards against two hunters claiming the same drop.
  const flipped = await prisma.drop.updateMany({
    where: { id: drop.id, status: "HIDDEN" },
    data: { status: "CLAIMED" },
  });
  if (flipped.count !== 1) throw new ApiError(409, "Someone just found this drop");

  const claim = await prisma.claim.create({
    data: {
      dropId: drop.id,
      campaignId: drop.campaignId,
      userId: opts.userId,
      amountCents: drop.amountCents,
      lat: opts.at.lat,
      lng: opts.at.lng,
      distanceM: dist,
    },
  });

  // Payout: real USDC when the campaign was funded on-chain and a treasury
  // key is configured; otherwise stays PENDING (dev mode / ledger only).
  let payoutStatus = "PENDING";
  let payoutTxSig: string | null = null;
  let payoutError: string | null = null;
  const canPay = Boolean(drop.campaign.fundingTxSig) && Boolean(treasuryKeypair());
  if (canPay) {
    try {
      payoutTxSig = await payout({ recipient: opts.wallet, cents: drop.amountCents });
      payoutStatus = "PAID";
    } catch (e) {
      payoutStatus = "FAILED";
      payoutError = e instanceof Error ? e.message : String(e);
      console.error("payout failed", claim.id, payoutError);
    }
  } else if (!devSkipFunding()) {
    payoutError = "Campaign not funded on-chain or treasury not configured";
  }
  await prisma.claim.update({
    where: { id: claim.id },
    data: { payoutStatus, payoutTxSig, payoutError },
  });

  const stats = (await campaignStats([drop.campaignId])).get(drop.campaignId)!;
  return {
    claimId: claim.id,
    amountCents: drop.amountCents,
    payoutStatus,
    payoutTxSig,
    confirmedInMs: Date.now() - started,
    areaName: drop.campaign.areaName,
    campaignTitle: drop.campaign.title,
    remaining: stats.remaining,
  };
}
