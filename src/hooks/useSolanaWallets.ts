"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import bs58 from "bs58";
import { Transaction } from "@solana/web3.js";

/**
 * A wallet the user can sign in with. Built from the Wallet Standard
 * registry (Phantom, Solflare, Backpack, Glow, Coinbase...) and, as a
 * fallback, from legacy `window.*` providers some wallets still inject.
 */
export type WalletChoice = {
  id: string;
  name: string;
  icon: string | null;
  /** Connect and list accounts (base58 addresses). */
  connect: () => Promise<string[]>;
  /** Sign bytes with the given account. */
  signMessage: (address: string, message: Uint8Array) => Promise<Uint8Array>;
  /** Sign and broadcast a serialized transaction; returns the signature bytes. */
  signAndSendTransaction: (address: string, transaction: Uint8Array, chain: string) => Promise<Uint8Array>;
  /**
   * Sign a serialized transaction without broadcasting it; returns the signed
   * bytes. Null when the wallet can't. Preferred for payments: the app then
   * submits to its own cluster, so the wallet's network setting can't send the
   * transaction to the wrong chain.
   */
  signTransaction: ((address: string, transaction: Uint8Array, chain: string) => Promise<Uint8Array>) | null;
};

type ConnectFeature = { connect: (opts?: { silent?: boolean }) => Promise<{ accounts: readonly WalletAccount[] }> };
type SignMessageFeature = {
  signMessage: (input: { account: WalletAccount; message: Uint8Array }) => Promise<readonly { signature: Uint8Array }[]>;
};
type SignTransactionFeature = {
  signTransaction: (input: { account: WalletAccount; transaction: Uint8Array; chain?: string }) => Promise<readonly { signedTransaction: Uint8Array }[]>;
};
type SignAndSendFeature = {
  signAndSendTransaction: (input: { account: WalletAccount; transaction: Uint8Array; chain: string }) => Promise<readonly { signature: Uint8Array }[]>;
};
type LegacyProvider = {
  isPhantom?: boolean;
  publicKey?: { toBase58(): string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toBase58(): string } } | void>;
  signMessage: (message: Uint8Array, display?: string) => Promise<{ signature: Uint8Array } | Uint8Array>;
  signAndSendTransaction?: (tx: Transaction) => Promise<{ signature: string }>;
  signTransaction?: (tx: Transaction) => Promise<Transaction>;
};

const isSolanaWallet = (w: Wallet) =>
  w.chains.some((c) => c.startsWith("solana:")) && "standard:connect" in w.features && "solana:signMessage" in w.features;

function fromStandard(w: Wallet): WalletChoice {
  let accounts: readonly WalletAccount[] = w.accounts;
  return {
    id: `std:${w.name}`,
    name: w.name,
    icon: w.icon,
    connect: async () => {
      const res = await (w.features["standard:connect"] as ConnectFeature).connect();
      accounts = res.accounts.length ? res.accounts : w.accounts;
      return accounts.map((a) => a.address);
    },
    signMessage: async (address, message) => {
      const account = accounts.find((a) => a.address === address) ?? w.accounts.find((a) => a.address === address);
      if (!account) throw new Error("Account not connected");
      const [out] = await (w.features["solana:signMessage"] as SignMessageFeature).signMessage({ account, message });
      return out.signature;
    },
    signAndSendTransaction: async (address, transaction, chain) => {
      const account = accounts.find((a) => a.address === address) ?? w.accounts.find((a) => a.address === address);
      if (!account) throw new Error("Account not connected");
      const f = w.features["solana:signAndSendTransaction"] as SignAndSendFeature | undefined;
      if (!f) throw new Error(`${w.name} can't send transactions from this page`);
      const [out] = await f.signAndSendTransaction({ account, transaction, chain });
      return out.signature;
    },
    signTransaction:
      "solana:signTransaction" in w.features
        ? async (address, transaction, chain) => {
            const account = accounts.find((a) => a.address === address) ?? w.accounts.find((a) => a.address === address);
            if (!account) throw new Error("Account not connected");
            const f = w.features["solana:signTransaction"] as SignTransactionFeature;
            const [out] = await f.signTransaction({ account, transaction, chain });
            return out.signedTransaction;
          }
        : null,
  };
}

function fromLegacy(name: string, provider: LegacyProvider, icon: string | null): WalletChoice {
  return {
    id: `legacy:${name}`,
    name,
    icon,
    connect: async () => {
      const r = await provider.connect();
      const pk = (r && "publicKey" in r ? r.publicKey : provider.publicKey) ?? provider.publicKey;
      if (!pk) throw new Error("Wallet did not return an account");
      return [pk.toBase58()];
    },
    signMessage: async (_address, message) => {
      const out = await provider.signMessage(message, "utf8");
      return out instanceof Uint8Array ? out : out.signature;
    },
    signAndSendTransaction: async (_address, transaction) => {
      if (!provider.signAndSendTransaction) throw new Error(`${name} can't send transactions from this page`);
      const { signature } = await provider.signAndSendTransaction(Transaction.from(transaction));
      return bs58.decode(signature);
    },
    signTransaction: provider.signTransaction
      ? async (_address, transaction) => {
          const signed = await provider.signTransaction!(Transaction.from(transaction));
          return new Uint8Array(signed.serialize());
        }
      : null,
  };
}

/** Legacy injections, used only when the same wallet isn't in the registry. */
function legacyChoices(): WalletChoice[] {
  if (typeof window === "undefined") return [];
  const w = window as unknown as Record<string, unknown>;
  const out: WalletChoice[] = [];
  const phantom = (w.phantom as { solana?: LegacyProvider } | undefined)?.solana ?? ((w.solana as LegacyProvider | undefined)?.isPhantom ? (w.solana as LegacyProvider) : undefined);
  if (phantom?.connect) out.push(fromLegacy("Phantom", phantom, null));
  const solflare = w.solflare as LegacyProvider | undefined;
  if (solflare?.connect) out.push(fromLegacy("Solflare", solflare, null));
  const backpack = w.backpack as LegacyProvider | undefined;
  if (backpack?.connect) out.push(fromLegacy("Backpack", backpack, null));
  const glow = w.glow as LegacyProvider | undefined;
  if (glow?.connect) out.push(fromLegacy("Glow", glow, null));
  return out;
}

// Snapshot cache so useSyncExternalStore gets a stable reference.
let snapshot: WalletChoice[] = [];
let snapshotKey = "";
let registry: ReturnType<typeof getWallets> | null = null;
function refresh() {
  const std = registry ? registry.get().filter(isSolanaWallet).map(fromStandard) : [];
  const names = new Set(std.map((c) => c.name.toLowerCase()));
  const legacy = legacyChoices().filter((c) => !names.has(c.name.toLowerCase()));
  const next = [...std, ...legacy];
  const key = next.map((c) => c.id).join("|");
  if (key !== snapshotKey) {
    snapshot = next;
    snapshotKey = key;
  }
}
function subscribe(cb: () => void) {
  registry ??= getWallets();
  refresh();
  const offs = [registry.on("register", () => (refresh(), cb())), registry.on("unregister", () => (refresh(), cb()))];
  // Wallets inject late on some browsers; poll for a few seconds.
  let n = 0;
  const t = setInterval(() => {
    const before = snapshotKey;
    refresh();
    if (snapshotKey !== before) cb();
    if (++n > 24) clearInterval(t);
  }, 250);
  return () => {
    offs.forEach((off) => off());
    clearInterval(t);
  };
}
const getSnapshot = () => snapshot;
const EMPTY: WalletChoice[] = [];
const getServerSnapshot = () => EMPTY;

export type SolanaWallet = WalletChoice;

/** Installed Solana wallets and a sign-in flow that works with any of them. */
export function useSolanaWallets() {
  const wallets = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  /**
   * Connect and list the wallet's accounts. Returns the addresses so the UI
   * can let the user pick one when there are several.
   */
  const connect = useCallback((wallet: WalletChoice) => wallet.connect(), []);

  /** Request a nonce, sign it with `address` and exchange it for an app session. */
  const signIn = useCallback(async (wallet: WalletChoice, address: string) => {
    const res = await fetch("/api/auth/nonce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address }),
    });
    const nonceData = (await res.json()) as { nonce: string; issuedAt: string; message: string; error?: string };
    if (!res.ok) throw new Error(nonceData.error ?? "Could not start sign-in");

    const signature = await wallet.signMessage(address, new TextEncoder().encode(nonceData.message));

    const verify = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet: address, nonce: nonceData.nonce, issuedAt: nonceData.issuedAt, signature: bs58.encode(signature) }),
    });
    const verified = (await verify.json()) as { error?: string };
    if (!verify.ok) throw new Error(verified.error ?? "Sign-in failed");
  }, []);

  return { wallets, connect, signIn };
}

/** Deep link that opens the current page inside Phantom's mobile browser. */
export function phantomBrowseLink(url: string) {
  const origin = new URL(url).origin;
  return `https://phantom.app/ul/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(origin)}`;
}

/**
 * Wallets we can hand the page to on a phone (each opens the site inside the
 * wallet's own browser, where it injects itself and sign-in works), plus
 * install links for desktop.
 */
export const WALLET_APPS = [
  { name: "Phantom", color: "#ab9ff2", browse: phantomBrowseLink, install: "https://phantom.app/download" },
  {
    name: "Solflare",
    color: "#fc7227",
    browse: (url: string) => `https://solflare.com/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`,
    install: "https://solflare.com/download",
  },
  {
    name: "Backpack",
    color: "#e33e3f",
    browse: (url: string) => `https://backpack.app/ul/v1/browse/${encodeURIComponent(url)}?ref=${encodeURIComponent(new URL(url).origin)}`,
    install: "https://backpack.app/download",
  },
] as const;

export const isMobile = () => typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
