import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handler, json, parseBody, requireSession } from "@/lib/api";
import { approveSubmission } from "@/lib/bounties";
import { requireMod } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), note: z.string().trim().max(500).optional() });

/** Mods approve (pays out) or reject a submission. */
export const POST = handler<Ctx>(async (req, { params }) => {
  const session = await requireSession();
  const mod = await requireMod(session);
  const { id } = await params;
  const body = await parseBody(req, Body);
  if (body.decision === "APPROVED") {
    const r = await approveSubmission(id, mod.id, body.note);
    return json({ ok: true, ...r });
  }
  const sub = await prisma.submission.findUnique({ where: { id } });
  if (!sub) throw new ApiError(404, "Submission not found");
  if (sub.status !== "PENDING") throw new ApiError(409, "Already reviewed");
  await prisma.submission.update({
    where: { id },
    data: { status: "REJECTED", reviewerId: mod.id, reviewNote: body.note ?? null, reviewedAt: new Date() },
  });
  return json({ ok: true });
});
