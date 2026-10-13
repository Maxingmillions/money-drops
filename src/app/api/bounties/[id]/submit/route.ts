import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handler, json, parseBody, requireSession } from "@/lib/api";
import { FileMeta, MAX_FILES, ownsPath } from "@/lib/uploads";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({
  videoUrl: z.string().url().max(500).optional(),
  note: z.string().trim().max(1000).optional(),
  files: z.array(FileMeta).max(MAX_FILES).default([]),
});

/** Submit proof (uploads and/or a video link) for a bounty. One submission per person. */
export const POST = handler<Ctx>(async (req, { params }) => {
  const session = await requireSession();
  const { id } = await params;
  const body = await parseBody(req, Body);
  if (!body.videoUrl && body.files.length === 0) throw new ApiError(400, "Add a video link or upload at least one file");
  if (body.files.some((f) => !ownsPath(f.pathname, session.userId))) throw new ApiError(400, "Invalid file");
  const b = await prisma.bounty.findUnique({ where: { id } });
  if (!b) throw new ApiError(404, "Bounty not found");
  if (b.status !== "OPEN") throw new ApiError(409, "This bounty isn't open");
  if (b.deadline && b.deadline < new Date()) throw new ApiError(409, "This bounty's deadline has passed");
  if (b.creatorId === session.userId) throw new ApiError(403, "You can't submit to your own bounty");
  const existing = await prisma.submission.findUnique({ where: { bountyId_userId: { bountyId: id, userId: session.userId } } });
  if (existing) throw new ApiError(409, "You already submitted to this bounty");
  const sub = await prisma.submission.create({
    data: { bountyId: id, userId: session.userId, videoUrl: body.videoUrl ?? null, note: body.note || null, files: body.files },
  });
  return json({ submission: { id: sub.id, status: sub.status } });
});
