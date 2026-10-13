import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handler, json, parseBody } from "@/lib/api";
import { createSession } from "@/lib/session";
import { createCustodialWallet, hashPassword } from "@/lib/custody";
import { syncRole } from "@/lib/roles";

const Body = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(8).max(200),
  handle: z.string().trim().min(2).max(24).regex(/^[a-z0-9_.]+$/i, "Letters, numbers, _ and . only").optional(),
});

/** Email + password signup. A Solana wallet is created for the account. */
export const POST = handler(async (req) => {
  const body = await parseBody(req, Body);
  if (await prisma.user.findUnique({ where: { email: body.email } })) throw new ApiError(409, "That email already has an account. Sign in instead.");
  if (body.handle && (await prisma.user.findUnique({ where: { handle: body.handle } }))) throw new ApiError(409, "That username is taken");
  const wallet = createCustodialWallet();
  const user = await prisma.user.create({
    data: {
      email: body.email,
      passwordHash: hashPassword(body.password),
      wallet: wallet.address,
      custodialSecret: wallet.custodialSecret,
      handle: body.handle ?? null,
      loginMethod: "email",
    },
  });
  await syncRole(user.id, user.wallet);
  await createSession({ userId: user.id, wallet: user.wallet });
  return json({ user: { id: user.id, wallet: user.wallet, handle: user.handle } });
});
