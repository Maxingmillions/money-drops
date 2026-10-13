import { z } from "zod";
import { Keypair, PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/db";
import { ApiError, handler, json, parseBody } from "@/lib/api";
import { createSession } from "@/lib/session";
import { syncRole } from "@/lib/roles";

const Body = z.object({ wallet: z.string().min(32).max(44).optional(), mod: z.boolean().optional() });

/**
 * Test sign-in: creates a session for any wallet address (or a fresh random
 * one) without a signature. On in development unless DEV_LOGIN=false; in
 * production only when DEV_LOGIN=true is set explicitly.
 */
export const POST = handler(async (req) => {
  const enabled =
    process.env.DEV_LOGIN === "true" ||
    (process.env.NODE_ENV !== "production" && process.env.DEV_LOGIN !== "false");
  if (!enabled) throw new ApiError(404, "Dev login is disabled");
  const body = await parseBody(req, Body);
  const wallet = body.wallet ?? Keypair.generate().publicKey.toBase58();
  try {
    new PublicKey(wallet);
  } catch {
    throw new ApiError(400, "Invalid wallet address");
  }
  // The mod shortcut is for local testing only; on a deployed site mods
  // come from ADMIN_WALLETS or a database role change.
  const makeMod = Boolean(body.mod) && process.env.NODE_ENV !== "production";
  const user = await prisma.user.upsert({
    where: { wallet },
    update: makeMod ? { role: "MOD" } : {},
    create: { wallet, loginMethod: "dev", role: makeMod ? "MOD" : "USER" },
  });
  await syncRole(user.id, user.wallet);
  await createSession({ userId: user.id, wallet: user.wallet });
  return json({ user: { id: user.id, wallet: user.wallet, handle: user.handle } });
});
