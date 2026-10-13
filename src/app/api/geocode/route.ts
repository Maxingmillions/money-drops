import { handler, json, requireSession } from "@/lib/api";

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: { name?: string; street?: string; housenumber?: string; city?: string; state?: string; country?: string; osm_key?: string; osm_value?: string };
};

/**
 * Address / place search via Photon (OpenStreetMap data, free, no key).
 * Optional lat/lng bias results toward the user.
 */
export const GET = handler(async (req) => {
  await requireSession();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return json({ results: [] });
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");
  const api = new URL("https://photon.komoot.io/api/");
  api.searchParams.set("q", q);
  api.searchParams.set("limit", "6");
  if (lat && lng) {
    api.searchParams.set("lat", lat);
    api.searchParams.set("lon", lng);
  }
  const UA = { "User-Agent": "Drops (money-drops.vercel.app)" };
  let results: { name: string; detail: string; lat: number; lng: number }[] = [];
  try {
    const res = await fetch(api, { headers: UA, signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = (await res.json()) as { features: PhotonFeature[] };
      results = data.features.map((f) => {
        const p = f.properties;
        const line1 = p.name || [p.housenumber, p.street].filter(Boolean).join(" ") || q;
        const line2 = [p.street && p.name ? p.street : null, p.city, p.state, p.country].filter(Boolean).join(", ");
        return { name: line1, detail: line2, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] };
      });
    }
  } catch {
    /* fall through to Nominatim */
  }
  if (results.length === 0) {
    try {
      const nom = new URL("https://nominatim.openstreetmap.org/search");
      nom.searchParams.set("q", q);
      nom.searchParams.set("format", "jsonv2");
      nom.searchParams.set("limit", "6");
      const res = await fetch(nom, { headers: UA, signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const rows = (await res.json()) as { display_name: string; name?: string; lat: string; lon: string }[];
        results = rows.map((r) => {
          const parts = r.display_name.split(", ");
          return { name: r.name || parts[0], detail: parts.slice(1, 4).join(", "), lat: Number(r.lat), lng: Number(r.lon) };
        });
      }
    } catch {
      /* give up quietly */
    }
  }
  return json({ results });
});
