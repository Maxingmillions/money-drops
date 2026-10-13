// Solana helpers. Client-safe constants live at the top; server-only payout
// and deposit verification live below and must only be imported on the server.
// Money moves as plain SOL (system transfers): no token accounts needed.
import { Connection, Keypair, PublicKey, SystemProgram, Transaction, clusterApiUrl, sendAndConfirmTransaction } from "@solana/web3.js";
import bs58 from "bs58";

export type Cluster = "devnet" | "mainnet-beta";

export const CLUSTER: Cluster =
  (process.env.NEXT_PUBLIC_SOLANA_CLUSTER as Cluster) === "mainnet-beta"
    ? "mainnet-beta"
    : "devnet";

export const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
);

export function rpcUrl() {
  return process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl(CLUSTER);
}

export function connection() {
  return new Connection(rpcUrl(), "confirmed");
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
 * Posts cost real SOL only for accounts that signed in with their own wallet
 * (they can pay from it). Email / social accounts and dev logins post without
 * an on-chain deposit, and DEV_SKIP_FUNDING=true turns funding off for everyone.
 */
export function requiresFunding(loginMethod: string | null | undefined) {
  if (devSkipFunding()) return false;
  if (!treasuryAddress()) return false;
  return loginMethod === "wallet";
}

/**
 * Verify that `signature` is a confirmed SOL transfer of at least
 * `expectedLamports` into the treasury wallet, carrying `memo`.
 */
export async function verifyDeposit(opts: {
  signature: string;
  expectedLamports: number;
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

  let memoOk = false;
  let received = 0;
  let payer: string | null = null;
  for (const ix of tx.transaction.message.instructions) {
    if (!("parsed" in ix)) continue;
    if (ix.program === "spl-memo" && typeof ix.parsed === "string" && ix.parsed === opts.memo) memoOk = true;
    if (ix.program === "system") {
      const p = ix.parsed as { type: string; info: { destination?: string; lamports?: number; source?: string } };
      if (p.type === "transfer" && p.info.destination === treasury.toBase58()) {
        received += Number(p.info.lamports ?? 0);
        payer = p.info.source ?? payer;
      }
    }
  }
  if (!memoOk) return { ok: false, reason: "Memo does not match" };
  if (received < opts.expectedLamports) return { ok: false, reason: "Deposit amount too small" };
  return { ok: true, payer: payer ?? "unknown" };
}

/** Pay `lamports` of SOL from the treasury to `recipient`. Returns the tx signature. */
export async function payout(opts: { recipient: string; lamports: number }) {
  const kp = treasuryKeypair();
  if (!kp) throw new Error("TREASURY_SECRET_KEY not configured");
  const conn = connection();
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: new PublicKey(opts.recipient), lamports: Math.round(opts.lamports) }),
  );
  return sendAndConfirmTransaction(conn, tx, [kp], { commitment: "confirmed" });
}
