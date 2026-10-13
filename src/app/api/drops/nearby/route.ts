import { z } from "zod";
import { ApiError, handler, json } from "@/lib/api";
import { nearbyDrops } from "@/lib/drops";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { maybeRunPoolDrops } from "@/lib/pool";

const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radius: z.coerce.number().min(50).max(60_000).default(3000),
  /** The hunter's own position (distances / reveals). Defaults to lat/lng. */
  ulat: z.coerce.number().min(-90).max(90).optional(),
  ulng: z.coerce.number().min(-180).max(180).optional(),
  /** "none" when the client has no fix yet: nothing gets revealed. */
  user: z.enum(["none"]).optional(),
});

export const GET = handler(async (req) => {
  const url = new URL(req.url);
  const parsed = Query.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) throw new ApiError(400, "lat and lng are required");
  const { lat, lng, radius, ulat, ulng, user } = parsed.data;
  const hunter = user === "none" ? null : ulat != null && ulng != null ? { lat: ulat, lng: ulng } : { lat, lng };
  // Remember where people are (feeds the pool's "populated areas") and give
  // the pool a chance to drop money; neither should ever break the map.
  const session = await getSession();
  if (session && hunter) {
    prisma.user.update({ where: { id: session.userId }, data: { lastLat: hunter.lat, lastLng: hunter.lng, lastSeenAt: new Date() } }).catch(() => {});
  }
  maybeRunPoolDrops().catch(() => null);
  const drops = await nearbyDrops({ lat, lng }, radius, hunter);
  return json({ drops, nearest: drops[0] ?? null });
});
