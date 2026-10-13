import { handler, json } from "@/lib/api";
import { dropForHunter } from "@/lib/drops";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat"));
  const lng = Number(url.searchParams.get("lng"));
  const at = Number.isFinite(lat) && Number.isFinite(lng) && url.searchParams.has("lat") ? { lat, lng } : null;
  return json({ drop: await dropForHunter(id, at) });
});
