// Solana helpers. Client-safe constants live at the top; server-only payout
// and deposit verification live below and must only be imported on the server.
import { Connection, Keypair, PublicKey, clusterApiUrl } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  transfer,
} from "@solana/spl-token";
import bs58 from "bs58";

export type Cluster = "devnet" | "mainnet-beta";

export const CLUSTER: Cluster =
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as Cluster) === "mainnet-beta"
    ? "mainnet-beta"
    : "devnet";

export const USDC_MINT = new PublicKey(
  CLUSTER === "mainnet-beta"
    ? "EPjFWdd5AufqSSqeM3qGFsnGdtl8pTMmhcrktyEwHA5" // Circle USDC
    : "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // Circle devnet USDC
);
export const USDC_DECIMALS = 6;

export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

export function rpcUrl() {
  return process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl(CLUSTER);
}

export function connection() {
  return new Connection(rpcUrl(), "confirmed");
}

/** USDC cents -> on-chain base units (6 decimals). */
export function centsToBaseUnits(cents: number): bigint {
  return BigInt(cents) * BigInt(10_000);
}

export function treasuryAddress(): PublicKey | null {
  const v = process.env.NEXT_PUBLIC_TREASURY_ADDRESS;
  if (!v) return null;
  try {
    return new PublicKey(v);
  } catch {
    return null;
  }
}

export function explorerTxUrl(sig: string) {
  const suffix = CLUSTER === "devnet" ? "?cluster=devnet" : "";
  return `https://explorer.solana.com/tx/${sig}${suffix}`;
}

// ---------------------------------------------------------------------------
// Server-only below.
// ---------------------------------------------------------------------------

export function treasuryKeypair(): Keypair | null {
  const secret = process.env.TREASURY_SECRET_KEY;
  if (!secret) return null;
  return Keypair.fromSecretKey(bs58.decode(secret));
}

export const devSkipFunding = () => process.env.DEV_SKIP_FUNDING === "true";

/**
 * Verify that `signature` is a confirmed USDC transfer of at least
 * `expectedCents` into the treasury token account, carrying `memo`.
 */
export async function verifyDeposit(opts: {
  signature: string;
  expectedCents: number;
  memo: string;
}): Promise<{ ok: true; payer: string } | { ok: false; reason: string }> {
  const treasury = treasuryAddress();
  if (!treasury) return { ok: false, reason: "Treasury not configured" };
  const conn = connection();
  const tx = await conn.getParsedTransaction(opts.signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx || tx.meta?.err) return { ok: false, reason: "Transaction not found or failed" };

  const treasuryAta = (await getAssociatedTokenAddress(USDC_MINT, treasury)).toBase58();
  const expectedBase = centsToBaseUnits(opts.expectedCents);

  let memoOk = false;
  let received = BigInt(0);
  let payer: string | null = null;

  for (const ix of tx.transaction.message.instructions) {
    if (!("parsed" in ix)) continue;
    if (ix.program === "spl-memo" && typeof ix.parsed === "string") {
      if (ix.parsed === opts.memo) memoOk = true;
    }
    if (ix.program === "spl-token") {
      const p = ix.parsed as {
        type: string;
        info: {
          destination?: string;
          amount?: string;
          tokenAmount?: { amount: string };
          mint?: string;
          authority?: string;
        };
      };
      if (
        (p.type === "transfer" || p.type === "transferChecked") &&
        p.info.destination === treasuryAta
      ) {
        if (p.type === "transferChecked" && p.info.mint !== USDC_MINT.toBase58()) continue;
        const amt = p.info.tokenAmount?.amount ?? p.info.amount ?? "0";
        received += BigInt(amt);
        payer = p.info.authority ?? payer;
      }
    }
  }

  if (!memoOk) return { ok: false, reason: "Memo does not match campaign" };
  if (received < expectedBase) return { ok: false, reason: "Deposit amount too small" };
  return { ok: true, payer: payer ?? "unknown" };
}

/** Pay `cents` of USDC from the treasury to `recipient`. Returns the tx signature. */
export async function payout(opts: { recipient: string; cents: number }) {
  const kp = treasuryKeypair();
  if (!kp) throw new Error("TREASURY_SECRET_KEY not configured");
  const conn = connection();
  const to = new PublicKey(opts.recipient);
  const fromAta = await getOrCreateAssociatedTokenAccount(conn, kp, USDC_MINT, kp.publicKey);
  const toAta = await getOrCreateAssociatedTokenAccount(conn, kp, USDC_MINT, to);
  return transfer(conn, kp, fromAta.address, toAta.address, kp, centsToBaseUnits(opts.cents));
}
