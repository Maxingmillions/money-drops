import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handler, json, parseBody } from "@/lib/api";
import { createSession } from "@/lib/session";
import { syncRole } from "@/lib/roles";
import { buildSignInMessage, verifySignature } from "@/lib/siws";

const Body = z.object({
  wallet: z.string().min(32).max(44),
  nonce: z.string().length(32),
  issuedAt: z.string(),
  signature: z.string().min(64),
});

/** Verifies a Sign-In With Solana signature from Phantom, Solflare, Backpack... */
export const POST = handler(async (req) => {
  const body = await parseBody(req, Body);
  const nonce = await prisma.nonce.findUnique({ where: { value: body.nonce } });
  if (!nonce || nonce.wallet !== body.wallet) throw new ApiError(400, "Unknown sign-in request");
  if (nonce.usedAt) throw new ApiError(400, "Sign-in request already used");
  if (nonce.expiresAt < new Date()) throw new ApiError(400, "Sign-in request expired, try again");

  const domain = new URL(req.url).host;
  const message = buildSignInMessage({ wallet: body.wallet, nonce: body.nonce, issuedAt: body.issuedAt, domain });
  if (!verifySignature({ message, signatureB58: body.signature, wallet: body.wallet })) {
    throw new ApiError(401, "Signature does not match wallet");
  }

  await prisma.nonce.update({ where: { value: body.nonce }, data: { usedAt: new Date() } });
  const user = await prisma.user.upsert({
    where: { wallet: body.wallet },
    update: {},
    create: { wallet: body.wallet, loginMethod: "wallet" },
  });
  await syncRole(user.id, user.wallet);
  await createSession({ userId: user.id, wallet: user.wallet });
  return json({ user: { id: user.id, wallet: user.wallet, handle: user.handle } });
});
