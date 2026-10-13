import { prisma } from "@/lib/db";
import { handler, json, requireSession } from "@/lib/api";
import { CLUSTER, connection } from "@/lib/solana";

/** Short-lived per-wallet balance cache so the pill polling doesn't hammer the RPC. */
const cache = new Map<string, { at: number; lamports: number | null }>();
const TTL_MS = 20_000;

async function balanceOf(wallet: string) {
  const hit = cache.get(wallet);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.lamports;
  let lamports: number | null = null;
  try {
    const { PublicKey } = await import("@solana/web3.js");
    lamports = await connection().getBalance(new PublicKey(wallet), "confirmed");
  } catch (e) {
    console.warn("[wallet] balance lookup failed:", e instanceof Error ? e.message : e);
  }
  cache.set(wallet, { at: Date.now(), lamports });
  return lamports;
}

/** On-chain SOL balance of the signed-in wallet plus what they've found so far. */
export const GET = handler(async () => {
  const session = await requireSession();
  const [lamports, found] = await Promise.all([
    balanceOf(session.wallet),
    prisma.claim.aggregate({ where: { userId: session.userId }, _sum: { amountLamports: true } }),
  ]);
  return json({
    wallet: session.wallet,
    cluster: CLUSTER,
    balanceLamports: lamports,
    foundLamports: found._sum.amountLamports ?? 0,
  });
});
