"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import bs58 from "bs58";

type ConnectFeature = { connect: (opts?: { silent?: boolean }) => Promise<{ accounts: readonly WalletAccount[] }> };
type SignMessageFeature = {
  signMessage: (input: { account: WalletAccount; message: Uint8Array }) => Promise<readonly { signature: Uint8Array }[]>;
};

export type SolanaWallet = Wallet;

const isSolanaWallet = (w: Wallet) =>
  w.chains.some((c) => c.startsWith("solana:")) && "standard:connect" in w.features && "solana:signMessage" in w.features;

// Snapshot cache so useSyncExternalStore gets a stable reference.
let snapshot: Wallet[] = [];
let registry: ReturnType<typeof getWallets> | null = null;
function refresh() {
  snapshot = registry ? registry.get().filter(isSolanaWallet) : [];
}
function subscribe(cb: () => void) {
  registry ??= getWallets();
  refresh();
  const offs = [registry.on("register", () => (refresh(), cb())), registry.on("unregister", () => (refresh(), cb()))];
  // Wallets inject late on some browsers; poll briefly.
  let n = 0;
  const t = setInterval(() => {
    const before = snapshot.length;
    refresh();
    if (snapshot.length !== before) cb();
    if (++n > 20) clearInterval(t);
  }, 250);
  return () => {
    offs.forEach((off) => off());
    clearInterval(t);
  };
}
const getSnapshot = () => snapshot;
const EMPTY: Wallet[] = [];
const getServerSnapshot = () => EMPTY;

/** Installed Solana wallets (Phantom, Solflare, Backpack...) via Wallet Standard. */
export function useSolanaWallets() {
  const wallets = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /** Connect, request a nonce, sign it and exchange for an app session. */
  const signIn = useCallback(async (wallet: Wallet) => {
    const connect = wallet.features["standard:connect"] as ConnectFeature;
    const { accounts } = await connect.connect();
    const account = accounts[0];
    if (!account) throw new Error("No account returned by the wallet");
    const address = account.address;

    const res = await fetch("/api/auth/nonce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address }),
    });
    const nonceData = (await res.json()) as { nonce: string; issuedAt: string; message: string; error?: string };
    if (!res.ok) throw new Error(nonceData.error ?? "Could not start sign-in");

    const sign = wallet.features["solana:signMessage"] as SignMessageFeature;
    const [out] = await sign.signMessage({ account, message: new TextEncoder().encode(nonceData.message) });

    const verify = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: address,
        nonce: nonceData.nonce,
        issuedAt: nonceData.issuedAt,
        signature: bs58.encode(out.signature),
      }),
    });
    const verified = (await verify.json()) as { error?: string };
    if (!verify.ok) throw new Error(verified.error ?? "Sign-in failed");
  }, []);

  return { wallets, signIn };
}

/** Deep link that opens the current page inside Phantom's mobile browser. */
export function phantomBrowseLink(url: string) {
  const origin = new URL(url).origin;
  return `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(origin)}`;
}
