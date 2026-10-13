import "server-only";
import { prisma } from "./db";
import { ApiError } from "./api";
import type { Session } from "./session";

/** Wallets listed in ADMIN_WALLETS are promoted to ADMIN on every sign-in. */
export function adminWallets(): Set<string> {
  return new Set((process.env.ADMIN_WALLETS ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

export async function syncRole(userId: string, wallet: string) {
  if (adminWallets().has(wallet)) {
    await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
  }
}

export const isMod = (role: string) => role === "MOD" || role === "ADMIN";

export async function requireMod(session: Session) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  if (!isMod(user.role)) throw new ApiError(403, "Mods only");
  return user;
}
