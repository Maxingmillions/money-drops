import { z } from "zod";
import { ApiError, handler, json } from "@/lib/api";
import { nearbyDrops } from "@/lib/drops";

const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(50).max(20_000).default(3000),
});

export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) throw new ApiError(400, "lat and lng are required");
  const { lat, lng, radius } = parsed.data;
  const drops = await nearbyDrops({ lat, lng }, radius);
  return json({ drops, nearest: drops[0] ?? null });
});
