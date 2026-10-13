import { z } from "zod";
import { handler, json, parseBody, requireSession } from "@/lib/api";
import { requireMod } from "@/lib/roles";
import { takeDownCampaign } from "@/lib/moderation";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ action: z.literal("takedown"), note: z.string().trim().max(500).optional() });

export const POST = handler<Ctx>(async (req, { params }) => {
  const session = await requireSession();
  await requireMod(session);
  const { id } = await params;
  const body = await parseBody(req, Body);
  return json(await takeDownCampaign(id, body.note));
});
