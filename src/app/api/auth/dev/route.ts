import { z } from "zod";
import { Keypair, PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/db";
import { ApiError, handler, json, parseBody } from "@/lib/api";
import { createSession } from "@/lib/session";

const Body = z.object({ wallet: z.string().min(32).max(44).optional() });

/**
 * Dev-only sign-in: creates a session for any wallet address (or a fresh
 * random one) without a signature. Enabled by DEV_LOGIN=true, never in prod.
 */
export const POST = handler(async (req) => {
  if (process.env.DEV_LOGIN !== "true" || process.env.NODE_ENV === "production") {
    throw new ApiError(404, "Not found");
  }
  const body = await parseBody(req, Body);
  const wallet = body.wallet ?? Keypair.generate().publicKey.toBase58();
  try {
    new PublicKey(wallet);
  } catch {
    throw new ApiError(400, "Invalid wallet address");
  }
  const user = await prisma.user.upsert({
    where: { wallet },
    update: {},
    create: { wallet, loginMethod: "dev" },
  });
  await createSession({ userId: user.id, wallet: user.wallet });
  return json({ user: { id: user.id, wallet: user.wallet, handle: user.handle } });
});
