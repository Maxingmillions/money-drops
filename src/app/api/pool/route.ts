import { handler, json } from "@/lib/api";
import { maybeRunPoolDrops, poolSummary } from "@/lib/pool";

export const GET = handler(async () => {
  await maybeRunPoolDrops().catch(() => null);
  return json(await poolSummary());
});
