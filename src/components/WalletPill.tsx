"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wallet, Sparkles } from "lucide-react";
import { api } from "@/lib/client";
import { formatSol } from "@/lib/geo";
import { SolMark } from "./Sol";

type Info = { wallet: string; cluster: string; balanceLamports: number | null; foundLamports: number };

/**
 * Compact wallet pill: on-chain SOL balance with the Solana mark, the short
 * address, and a "found" badge. Polls every 30 s; the API caches the RPC call.
 */
export function WalletPill({ className = "" }: { className?: string }) {
  const [info, setInfo] = useState<Info | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => api<Info>("/api/wallet").then((r) => alive && setInfo(r)).catch(() => {});
    load();
    const t = setInterval(load, 30_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (!info) return null;
  const short = `${info.wallet.slice(0, 4)}…${info.wallet.slice(-4)}`;
  const balance = info.balanceLamports;
  return (
    <Link href="/home" className={`pop-in flex items-center gap-2 rounded-full bg-elev py-1.5 pl-2 pr-3 text-sm shadow-[var(--shadow)] ring-1 ring-line ${className}`} title={`${info.wallet} · ${info.cluster}`}>
      <span className="grid h-7 w-7 place-items-center rounded-full bg-accent-soft text-accent">
        <Wallet size={14} />
      </span>
      <span className="flex items-baseline gap-1 font-bold tabular-nums">
        <SolMark />
        {balance == null ? "—" : formatSol(balance, { compact: true })}
      </span>
      <span className="font-mono text-xs text-muted">{short}</span>
      {info.foundLamports > 0 && (
        <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
          <Sparkles size={11} /> {formatSol(info.foundLamports, { compact: true })} found
        </span>
      )}
    </Link>
  );
}
