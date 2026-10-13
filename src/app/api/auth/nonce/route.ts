import { randomBytes } from "node:crypto";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { prisma } from "@/lib/db";
import { ApiError, handler, json, parseBody } from "@/lib/api";
import { buildSignInMessage } from "@/lib/siws";

const Body = z.object({ wallet: z.string().min(32).max(44) });

export const POST = handler(async (req) => {
  const { wallet } = await parseBody(req, Body);
  try {
    new PublicKey(wallet);
  } catch {
    throw new ApiError(400, "Invalid wallet address");
  }
  const nonce = randomBytes(16).toString("hex");
  const issuedAt = new Date().toISOString();
  const domain = new URL(req.url).host;
  await prisma.nonce.create({
    data: { value: nonce, wallet, expiresAt: new Date(Date.now() + 5 * 60_000) },
  });
  return json({ nonce, issuedAt, domain, message: buildSignInMessage({ wallet, nonce, issuedAt, domain }) });
});
