import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError, handler, json, parseBody } from "@/lib/api";
import { createSession } from "@/lib/session";
import { identityFromToken, privyEnabled } from "@/lib/privy";

const Body = z.object({
  identityToken: z.string().min(20),
  /** Which of the user's Solana wallets should receive payouts. */
  wallet: z.string().min(32).max(44).optional(),
});

/**
 * Exchange a Privy identity token for a Money Drops session. Works for every
 * Privy login method (Phantom & other wallets, Google, Apple, email...).
 */
export const POST = handler(async (req) => {
  if (!privyEnabled()) throw new ApiError(503, "Privy is not configured on this server");
  const body = await parseBody(req, Body);

  let identity;
  try {
    identity = await identityFromToken(body.identityToken);
  } catch {
    throw new ApiError(401, "Could not verify sign-in, please try again");
  }
  if (identity.solanaWallets.length === 0) {
    throw new ApiError(409, "No Solana wallet on this account yet. Finish wallet setup and retry.");
  }

  // Prefer the wallet the client chose (it must belong to the user), else an
  // external wallet, else the embedded one.
  const chosen =
    (body.wallet && identity.solanaWallets.find((w) => w.address === body.wallet)) ||
    identity.solanaWallets.find((w) => !w.embedded) ||
    identity.solanaWallets[0];

  const existing = await prisma.user.findUnique({ where: { privyId: identity.privyId } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { wallet: chosen.address, email: identity.email ?? existing.email },
      })
    : await prisma.user.upsert({
        // A wallet-only user from before may exist under the same address.
        where: { wallet: chosen.address },
        update: { privyId: identity.privyId, email: identity.email, loginMethod: identity.loginMethod },
        create: {
          wallet: chosen.address,
          privyId: identity.privyId,
          email: identity.email,
          loginMethod: identity.loginMethod,
        },
      });

  await createSession({ userId: user.id, wallet: user.wallet });
  return json({ user: { id: user.id, wallet: user.wallet, handle: user.handle } });
});
