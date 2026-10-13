// Pure geo helpers shared by client and server.

export type LatLng = { lat: number; lng: number };

const EARTH_RADIUS_M = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle distance in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

/** Initial bearing from a to b in degrees, 0 = north, clockwise. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.lat);
  const φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Move a point by `distM` metres along `bearing` degrees. */
export function offsetM(origin: LatLng, distM: number, bearing: number): LatLng {
  const δ = distM / EARTH_RADIUS_M;
  const θ = toRad(bearing);
  const φ1 = toRad(origin.lat);
  const λ1 = toRad(origin.lng);
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ),
  );
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  return { lat: toDeg(φ2), lng: ((toDeg(λ2) + 540) % 360) - 180 };
}

/** Bounding box (degrees) around a point, for cheap DB prefiltering. */
export function boundingBox(center: LatLng, radiusM: number) {
  const dLat = toDeg(radiusM / EARTH_RADIUS_M);
  const dLng = toDeg(radiusM / (EARTH_RADIUS_M * Math.cos(toRad(center.lat))));
  return {
    minLat: center.lat - dLat,
    maxLat: center.lat + dLat,
    minLng: center.lng - dLng,
    maxLng: center.lng + dLng,
  };
}

/** Small deterministic hash so a drop's fuzzed position is stable per id. */
function hash32(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Centre of the public search circle for a hidden drop: the real spot nudged
 * in a direction derived from its id. The nudge is at most
 * (searchRadius - revealRadius) so the whole reveal zone sits inside the
 * circle: hunters have to wander the circle until they're within the reveal
 * radius of the real spot.
 */
export function fuzzPosition(id: string, exact: LatLng, searchRadiusM: number, revealRadiusM: number): LatLng {
  const h = hash32(id);
  const bearing = h % 360;
  const maxM = Math.max(4, searchRadiusM - revealRadiusM - 3);
  const dist = Math.min(maxM, 4 + ((h >>> 9) % maxM));
  return offsetM(exact, dist, bearing);
}

export type Tier = { count: number; amountCents: number };

/** Scatter drops uniformly inside a circle. */
export function scatterDrops(
  area: { centerLat: number; centerLng: number; radiusM: number },
  tiers: Tier[],
  rand: () => number = Math.random,
) {
  const out: { amountCents: number; lat: number; lng: number }[] = [];
  for (const tier of tiers) {
    for (let i = 0; i < tier.count; i++) {
      // sqrt for uniform density over the disc
      const r = Math.sqrt(rand()) * area.radiusM;
      const θ = rand() * 360;
      const p = offsetM({ lat: area.centerLat, lng: area.centerLng }, r, θ);
      out.push({ amountCents: tier.amountCents, lat: p.lat, lng: p.lng });
    }
  }
  return out;
}

export function formatUsd(cents: number, opts: { compact?: boolean } = {}) {
  const dollars = cents / 100;
  if (opts.compact && Number.isInteger(dollars)) return `$${dollars.toLocaleString()}`;
  return `$${dollars.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function walkMinutes(m: number) {
  return Math.max(1, Math.round(m / 80)); // ~80 m/min
}
