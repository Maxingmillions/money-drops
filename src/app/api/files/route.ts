import { get } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { ApiError, handler, requireSession } from "@/lib/api";
import { isMod } from "@/lib/roles";
import { ownsPath, uploadsEnabled } from "@/lib/uploads";

/**
 * Streams a private upload. Allowed: mods, the uploader, and once the
 * submission is approved, the bounty's creator and anyone else signed in.
 */
export const GET = handler(async (req) => {
  const session = await requireSession();
  if (!uploadsEnabled()) throw new ApiError(503, "Uploads aren't configured");
  const pathname = new URL(req.url).searchParams.get("path") ?? "";
  if (!pathname.startsWith("submissions/")) throw new ApiError(400, "Bad path");

  const me = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  let allowed = isMod(me.role) || ownsPath(pathname, me.id);
  if (!allowed) {
    const sub = await prisma.submission.findFirst({
      where: { files: { array_contains: [{ pathname }] } },
      include: { bounty: { select: { creatorId: true } } },
    });
    allowed = Boolean(sub && (sub.status === "APPROVED" || sub.bounty.creatorId === me.id));
  }
  if (!allowed) throw new ApiError(403, "Only mods can see this until it's approved");

  const file = await get(pathname, { access: "private" });
  if (!file || !file.stream) throw new ApiError(404, "File not found");
  return new Response(file.stream, {
    headers: {
      "Content-Type": file.blob.contentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename="${pathname.split("/").pop()}"`,
    },
  });
});
