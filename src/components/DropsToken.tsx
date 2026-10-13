"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LineChart, ExternalLink, TrendingDown, TrendingUp } from "lucide-react";

/** Mint address of the $DROPS token. Unset until launch. */
export const DROPS_TOKEN = process.env.NEXT_PUBLIC_DROPS_TOKEN ?? "";

type Pair = {
  pairAddress: string;
  url: string;
  priceUsd?: string;
  priceChange?: { h24?: number };
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
};

export function useDropsPair() {
  const [pair, setPair] = useState<Pair | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">(DROPS_TOKEN ? "loading" : "idle");
  useEffect(() => {
    if (!DROPS_TOKEN) return;
    let cancelled = false;
    fetch(`https://api.dexscreener.com/latest/dex/tokens/${DROPS_TOKEN}`)
      .then((r) => r.json())
      .then((d: { pairs?: Pair[] }) => {
        if (cancelled) return;
        const best = (d.pairs ?? []).sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0] ?? null;
        setPair(best);
        setState(best ? "ready" : "error");
      })
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, []);
  return { pair, state };
}

const money = (n?: number) =>
  n == null ? "—" : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`;

/** Compact $DROPS ticker card. `href` controls where the chart button goes. */
export function DropsTokenCard({ href = "/token", external = false }: { href?: string; external?: boolean }) {
  const { pair, state } = useDropsPair();
  const change = pair?.priceChange?.h24;
  const up = (change ?? 0) >= 0;
  const chartHref = external && pair ? pair.url : href;

  return (
    <div className="card flex items-center gap-3 p-3 pr-4">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#9945FF] to-[#14F195] text-sm font-black text-white shadow-md">
        $D
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-bold">$DROPS</span>
          {state === "ready" && change != null && (
            <span className={`pill ${up ? "bg-success-soft text-success" : "bg-red-50 text-danger"}`}>
              {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {change.toFixed(1)}%
            </span>
          )}
          {state === "idle" && <span className="pill bg-accent-soft text-accent">Launching soon</span>}
        </div>
        <div className="truncate text-xs text-muted">
          {state === "ready" && pair
            ? `$${Number(pair.priceUsd ?? 0).toPrecision(4)} · MC ${money(pair.marketCap ?? pair.fdv)} · 24h vol ${money(pair.volume?.h24)}`
            : state === "loading"
              ? "Loading from DexScreener…"
              : state === "error"
                ? "No DexScreener pair yet"
                : "The token behind the hunt. Chart lands here at launch."}
        </div>
      </div>
      {external ? (
        <a href={chartHref} target="_blank" rel="noreferrer" className={`icon-btn !h-9 !w-9 ${state !== "ready" ? "pointer-events-none opacity-40" : ""}`} aria-label="Open chart">
          <ExternalLink size={16} />
        </a>
      ) : (
        <Link href={chartHref} className="icon-btn !h-9 !w-9" aria-label="Open chart">
          <LineChart size={16} />
        </Link>
      )}
    </div>
  );
}

/** Full DexScreener chart embed for the $DROPS token. */
export function DropsTokenChart() {
  const { pair, state } = useDropsPair();
  if (!DROPS_TOKEN) {
    return (
      <div className="card flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-[#9945FF] to-[#14F195] text-xl font-black text-white shadow-lg">
          $D
        </div>
        <h2 className="mt-4 text-xl font-bold">$DROPS is launching soon</h2>
        <p className="mt-1 max-w-[380px] text-sm text-muted">
          The live DexScreener chart shows up here the moment the token is out. Hunters and hiders will earn and spend it.
        </p>
      </div>
    );
  }
  const target = pair ? pair.pairAddress : DROPS_TOKEN;
  if (state === "loading") return <div className="card min-h-[320px] animate-pulse" />;
  return (
    <div className="card overflow-hidden">
      <iframe
        title="$DROPS on DexScreener"
        src={`https://dexscreener.com/solana/${target}?embed=1&theme=light&trades=0&info=0`}
        className="h-[70vh] min-h-[480px] w-full border-0"
        allow="clipboard-write"
      />
    </div>
  );
}
