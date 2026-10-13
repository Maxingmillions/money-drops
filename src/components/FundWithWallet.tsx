"use client";

import { useState } from "react";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import bs58 from "bs58";
import { Wallet, RefreshCw } from "lucide-react";
import { api } from "@/lib/client";
import { formatSol } from "@/lib/geo";
import { CLUSTER, MEMO_PROGRAM_ID, connection, explorerTxUrl } from "@/lib/solana";
import { useSolanaWallets } from "@/hooks/useSolanaWallets";

const CONFIRM_MS = 45_000;

function readSaved(key: string) {
  try {
    return typeof window === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}
const FEE_BUFFER = 10_000; // lamports kept back for the network fee

/**
 * Pays SOL from the signed-in wallet into escrow (system transfer + memo),
 * then asks the server to verify the deposit and open the post.
 */
export function FundWithWallet({
  memo,
  lamports,
  treasury,
  wallet,
  fundPath,
  onFunded,
}: {
  memo: string;
  lamports: number;
  treasury: string;
  /** The wallet address on the session; the connected wallet must match. */
  wallet: string;
  fundPath: string;
  onFunded: () => void;
}) {
  const { wallets } = useSolanaWallets();
  const [busy, setBusy] = useState(false);
  const storageKey = `fund:${memo}`;
  // A page reload mid-payment shouldn't lose the signature. (This component only
  // renders client-side after the post loads, so reading storage here is safe.)
  const saved = readSaved(storageKey);
  const [msg, setMsg] = useState<string | null>(saved ? 'You already sent a payment for this. Tap "Check again" to verify it.' : null);
  const [sig, setSig] = useState<string | null>(saved);
  const [needsRetry, setNeedsRetry] = useState(Boolean(saved));

  /** Ask the server to verify `signature` and open the post. */
  const verify = async (signature: string) => {
    setBusy(true);
    setNeedsRetry(false);
    setMsg("Verifying deposit…");
    try {
      await api(fundPath, { method: "POST", json: { signature } });
      try {
        localStorage.removeItem(storageKey);
      } catch {}
      setMsg(null);
      onFunded();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Verification failed");
      setNeedsRetry(true);
    } finally {
      setBusy(false);
    }
  };

  const fund = async () => {
    setBusy(true);
    setMsg(null);
    setNeedsRetry(false);
    try {
      // Find the installed wallet that holds the session's address.
      let provider: (typeof wallets)[number] | null = null;
      for (const w of wallets) {
        const accounts = await w.connect().catch(() => [] as string[]);
        if (accounts.includes(wallet)) {
          provider = w;
          break;
        }
      }
      if (!provider) throw new Error(`Connect the wallet ${wallet.slice(0, 4)}…${wallet.slice(-4)} to pay`);

      const conn = connection();
      const from = new PublicKey(wallet);

      // Catch the common failure before the wallet does: no SOL on this cluster.
      const balance = await conn.getBalance(from, "confirmed").catch(() => null);
      if (balance !== null && balance < lamports + FEE_BUFFER) {
        throw new Error(
          `This wallet has ${formatSol(balance)} on ${CLUSTER}, but ${formatSol(lamports)} is needed.` +
            (CLUSTER === "devnet" ? " Get free devnet SOL at faucet.solana.com, then try again." : " Top it up and try again."),
        );
      }

      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: from, toPubkey: new PublicKey(treasury), lamports: Math.round(lamports) }),
        new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from(memo, "utf8") }),
      );
      tx.feePayer = from;
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;

      const sigBytes = await provider.signAndSendTransaction(
        wallet,
        tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
        CLUSTER === "mainnet-beta" ? "solana:mainnet" : "solana:devnet",
      );
      const signature = bs58.encode(sigBytes);
      setSig(signature);
      try {
        localStorage.setItem(storageKey, signature);
      } catch {}

      // Poll for confirmation with a hard cap so the page never sits forever.
      const started = Date.now();
      let confirmed = false;
      while (Date.now() - started < CONFIRM_MS) {
        const left = Math.ceil((CONFIRM_MS - (Date.now() - started)) / 1000);
        setMsg(`Sent. Waiting for ${CLUSTER} to confirm… (${left}s)`);
        const st = await conn.getSignatureStatuses([signature]).catch(() => null);
        const s = st?.value?.[0];
        if (s?.err) throw new Error(`Transaction failed on-chain: ${JSON.stringify(s.err)}`);
        if (s && (s.confirmationStatus === "confirmed" || s.confirmationStatus === "finalized")) {
          confirmed = true;
          break;
        }
        const height = await conn.getBlockHeight("confirmed").catch(() => 0);
        if (height > lastValidBlockHeight) break; // blockhash expired; the tx can no longer land
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!confirmed) {
        setMsg(`${CLUSTER} hasn't confirmed it yet. If your wallet shows the transaction as sent, tap "Check again" in a moment. If the wallet rejected it, nothing was charged.`);
        setNeedsRetry(true);
        setBusy(false);
        return;
      }
      await verify(signature);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Payment failed");
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button className="btn btn-primary w-full" disabled={busy || wallets.length === 0} onClick={fund}>
        <Wallet size={16} /> Pay {formatSol(lamports)} from your wallet
      </button>
      {needsRetry && sig && (
        <button className="btn btn-secondary mt-2 w-full" disabled={busy} onClick={() => verify(sig)}>
          <RefreshCw size={16} /> Check again
        </button>
      )}
      {wallets.length === 0 && <p className="mt-2 text-xs text-muted">No Solana wallet detected in this browser.</p>}
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
      {sig && (
        <p className="mt-1 text-[11px] text-faint">
          Transaction{" "}
          <a className="text-accent" href={explorerTxUrl(sig)} target="_blank" rel="noreferrer">
            {sig.slice(0, 8)}…{sig.slice(-6)} ↗
          </a>
        </p>
      )}
      <p className="mt-2 text-[11px] text-faint">
        {CLUSTER === "devnet" ? "This is devnet SOL (test money). Get some free at faucet.solana.com." : "Mainnet SOL."} Unclaimed money comes back to you.
      </p>
    </div>
  );
}
