"use client";

import { useState } from "react";
import { PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import type { WalletAccount } from "@wallet-standard/base";
import bs58 from "bs58";
import { Wallet } from "lucide-react";
import { api } from "@/lib/client";
import { formatSol } from "@/lib/geo";
import { CLUSTER, MEMO_PROGRAM_ID, connection } from "@/lib/solana";
import { useSolanaWallets } from "@/hooks/useSolanaWallets";

type SignAndSend = {
  signAndSendTransaction: (input: { account: WalletAccount; transaction: Uint8Array; chain: string }) => Promise<readonly { signature: Uint8Array }[]>;
};
type Connect = { connect: (opts?: { silent?: boolean }) => Promise<{ accounts: readonly WalletAccount[] }> };

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
  const [msg, setMsg] = useState<string | null>(null);

  const fund = async () => {
    setBusy(true);
    setMsg(null);
    try {
      // Find an installed wallet that holds the session's address.
      let account: WalletAccount | null = null;
      let provider: (typeof wallets)[number] | null = null;
      for (const w of wallets) {
        const { accounts } = await (w.features["standard:connect"] as Connect).connect().catch(() => ({ accounts: [] as WalletAccount[] }));
        const hit = accounts.find((a) => a.address === wallet);
        if (hit) {
          account = hit;
          provider = w;
          break;
        }
      }
      if (!account || !provider) throw new Error(`Connect the wallet ${wallet.slice(0, 4)}…${wallet.slice(-4)} to pay`);

      const conn = connection();
      const from = new PublicKey(wallet);
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: from, toPubkey: new PublicKey(treasury), lamports: Math.round(lamports) }),
        new TransactionInstruction({ programId: MEMO_PROGRAM_ID, keys: [], data: Buffer.from(memo, "utf8") }),
      );
      tx.feePayer = from;
      tx.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;

      const [out] = await (provider.features["solana:signAndSendTransaction"] as SignAndSend).signAndSendTransaction({
        account,
        transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
        chain: CLUSTER === "mainnet-beta" ? "solana:mainnet" : "solana:devnet",
      });
      const sig = bs58.encode(out.signature);
      setMsg("Sent. Waiting for confirmation…");
      await conn.confirmTransaction(sig, "confirmed").catch(() => {});
      await api(fundPath, { method: "POST", json: { signature: sig } });
      onFunded();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button className="btn btn-primary w-full" disabled={busy || wallets.length === 0} onClick={fund}>
        <Wallet size={16} /> Pay {formatSol(lamports)} from your wallet
      </button>
      {wallets.length === 0 && <p className="mt-2 text-xs text-muted">No Solana wallet detected in this browser.</p>}
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
      <p className="mt-2 text-[11px] text-faint">
        {CLUSTER === "devnet" ? "Devnet SOL. Get some from faucet.solana.com." : "Mainnet SOL."} Unclaimed money comes back to you.
      </p>
    </div>
  );
}
