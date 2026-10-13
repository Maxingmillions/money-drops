import { z } from "zod";
import { handler, json, parseBody, requireSession } from "@/lib/api";
import { claimDrop } from "@/lib/drops";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracyM: z.number().min(0).max(10_000).optional(),
});

export const POST = handler<Ctx>(async (req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const body = await parseBody(req, Body);
  const result = await claimDrop({
    dropId: id,
    userId: session.userId,
    wallet: session.wallet,
    at: { lat: body.lat, lng: body.lng },
    accuracyM: body.accuracyM,
  });
  return json(result);
});
