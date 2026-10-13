import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/db";
import { ApiError, handler, json, parseBody, requireSession } from "@/lib/api";

const Body = z.object({ wallet: z.string().min(32).max(44), role: z.enum(["USER", "MOD"]) });

/** Admins promote or demote mods by wallet address. */
export const POST = handler(async (req) => {
  const session = await requireSession();
  const me = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (me.role !== "ADMIN") throw new ApiError(403, "Admins only");
  const body = await parseBody(req, Body);
  try {
    new PublicKey(body.wallet);
  } catch {
    throw new ApiError(400, "Invalid wallet address");
  }
  const target = await prisma.user.findUnique({ where: { wallet: body.wallet } });
  if (target?.role === "ADMIN") throw new ApiError(400, "Admins are managed with ADMIN_WALLETS");
  const user = await prisma.user.upsert({
    where: { wallet: body.wallet },
    update: { role: body.role },
    create: { wallet: body.wallet, role: body.role, loginMethod: "pending" },
  });
  return json({ user: { id: user.id, wallet: user.wallet, role: user.role } });
});
