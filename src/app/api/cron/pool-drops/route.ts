import { ApiError, handler, json } from "@/lib/api";
import { maybeRunPoolDrops, runPoolDrop } from "@/lib/pool";

/** Optional real cron (Vercel Cron / external). The app also runs this lazily. */
export const GET = handler(async (req) => {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) throw new ApiError(401, "Unauthorized");
  // ?force=1 skips the 15-minute wait (needs CRON_SECRET in production).
  const force = new URL(req.url).searchParams.get("force") === "1" && (process.env.NODE_ENV !== "production" || Boolean(secret));
  return json({ ran: force ? await runPoolDrop() : await maybeRunPoolDrops() });
});
