"use client";

import { useState } from "react";
import { useSignAndSendTransaction, useWallets } from "@privy-io/react-auth/solana";
import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import bs58 from "bs58";
import { Wallet } from "lucide-react";
import { api } from "@/lib/client";
import { formatUsd } from "@/lib/geo";
import { CLUSTER, MEMO_PROGRAM_ID, USDC_DECIMALS, USDC_MINT, centsToBaseUnits, connection } from "@/lib/solana";

/**
 * Builds a USDC transfer (with the campaign id as memo) to the escrow wallet,
 * has the user's Privy wallet sign and send it, then asks the server to verify.
 */
export function FundWithWallet({
  campaignId,
  amountCents,
  treasury,
  onFunded,
  fundPath,
}: {
  campaignId: string;
  amountCents: number;
  treasury: string;
  onFunded: () => void;
  /** API route that verifies the deposit. Defaults to the campaign route. */
  fundPath?: string;
}) {
  const { wallets, ready } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const wallet = wallets[0];

  const fund = async () => {
    if (!wallet) return;
    setBusy(true);
    setMsg(null);
    try {
      const conn = connection();
      const owner = new PublicKey(wallet.address);
      const to = new PublicKey(treasury);
      const fromAta = getAssociatedTokenAddressSync(USDC_MINT, owner);
      const toAta = getAssociatedTokenAddressSync(USDC_MINT, to);

      const tx = new Transaction().add(
        createAssociatedTokenAccountIdempotentInstruction(owner, toAta, to, USDC_MINT),
        createTransferCheckedInstruction(fromAta, USDC_MINT, toAta, owner, centsToBaseUnits(amountCents), USDC_DECIMALS),
        new TransactionInstruction({
          programId: MEMO_PROGRAM_ID,
          keys: [],
          data: Buffer.from(campaignId, "utf8"),
        }),
      );
      tx.feePayer = owner;
      tx.recentBlockhash = (await conn.getLatestBlockhash("confirmed")).blockhash;

      const { signature } = await signAndSendTransaction({
        transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
        wallet,
        chain: CLUSTER === "mainnet-beta" ? "solana:mainnet" : "solana:devnet",
      });
      const sig = bs58.encode(signature);
      setMsg("Sent. Verifying deposit…");
      await conn.confirmTransaction(sig, "confirmed").catch(() => {});
      await api(fundPath ?? `/api/campaigns/${campaignId}/fund`, { method: "POST", json: { signature: sig } });
      onFunded();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Funding failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button className="btn btn-primary w-full" disabled={!ready || !wallet || busy} onClick={fund}>
        <Wallet size={16} /> Fund {formatUsd(amountCents)} USDC
      </button>
      {!wallet && ready && <p className="mt-2 text-xs text-muted">No Solana wallet connected.</p>}
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
      <p className="mt-2 text-[11px] text-faint">
        {CLUSTER === "devnet" ? "Devnet: get test USDC from faucet.circle.com." : "Mainnet USDC."}
      </p>
    </div>
  );
}
