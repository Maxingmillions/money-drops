import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handler, json, parseBody } from "@/lib/api";
import { createSession } from "@/lib/session";
import { verifyPassword } from "@/lib/custody";
import { syncRole } from "@/lib/roles";

const Body = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

export const POST = handler(async (req) => {
  const body = await parseBody(req, Body);
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user?.passwordHash || !verifyPassword(body.password, user.passwordHash)) {
    throw new ApiError(401, "Wrong email or password");
  }
  await syncRole(user.id, user.wallet);
  await createSession({ userId: user.id, wallet: user.wallet });
  return json({ user: { id: user.id, wallet: user.wallet, handle: user.handle } });
});
