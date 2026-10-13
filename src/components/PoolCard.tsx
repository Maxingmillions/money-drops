"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Droplets, Clock, ArrowDownToLine, Percent } from "lucide-react";
import { api } from "@/lib/client";
import { formatSol } from "@/lib/geo";

type Pool = {
  feeBps: number;
  poolShareBps: number;
  balanceLamports: number;
  feesCollectedLamports: number;
  poolCollectedLamports: number;
  droppedLamports: number;
  runs: number;
  lastRunAt: string | null;
  nextRunAt: string;
  intervalMs: number;
  events: { id: string; kind: string; lamports: number; poolLamports: number; areaName: string | null; campaignId: string | null; onChain: boolean; createdAt: string }[];
};

function useCountdown(to: string | null) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!to) return;
    const tick = () => setLeft(Math.max(0, new Date(to).getTime() - Date.now()));
    const t = setInterval(tick, 1000);
    tick();
    return () => clearInterval(t);
  }, [to]);
  return left;
}

/** Fee split and community drop pool: how much has accumulated, when it drops next. */
export function PoolCard({ compact = false }: { compact?: boolean }) {
  const [pool, setPool] = useState<Pool | null>(null);
  useEffect(() => {
    let cancelled = false;
    const pull = () => api<Pool>("/api/pool").then((p) => !cancelled && setPool(p)).catch(() => {});
    pull();
    const t = setInterval(pull, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);
  const left = useCountdown(pool?.nextRunAt ?? null);
  const mm = left != null ? Math.floor(left / 60_000) : null;
  const ss = left != null ? Math.floor((left % 60_000) / 1000) : null;
  const feePct = pool ? pool.feeBps / 100 : 5;
  const sharePct = pool ? pool.poolShareBps / 100 : 50;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#14F195] to-[#9945FF] text-white shadow-md">
          <Droplets size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-bold">Drop pool</div>
          <div className="text-xs text-muted">
            {feePct}% fee on every hunt and bounty · {sharePct}% of it fills the pool · {100 - sharePct}% runs Drops
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold leading-tight">{pool ? formatSol(pool.balanceLamports) : "—"}</div>
          <div className="text-[10px] font-semibold text-muted">in the pool</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Fees" value={pool ? formatSol(pool.feesCollectedLamports) : "—"} Icon={Percent} />
        <Stat label="Dropped" value={pool ? formatSol(pool.droppedLamports) : "—"} Icon={ArrowDownToLine} />
        <Stat label="Next drop" value={mm != null ? `${mm}:${String(ss).padStart(2, "0")}` : "—"} Icon={Clock} />
      </div>
      <p className="mt-2 text-[11px] text-faint">Every 15 minutes the pool scatters random drops within a few miles of where people are hunting.</p>

      {!compact && pool && pool.events.length > 0 && (
        <ul className="row-list mt-3 text-xs">
          {pool.events.slice(0, 6).map((e) => (
            <li key={e.id} className="flex items-center gap-2 px-3 py-2">
              <span className={`pill ${e.kind === "DROP" ? "bg-success-soft text-success" : "bg-accent-soft text-accent"}`}>{e.kind === "DROP" ? "drop" : "fee"}</span>
              <span className="min-w-0 flex-1 truncate text-muted">
                {e.kind === "DROP" ? (
                  <>
                    {formatSol(e.lamports)} scattered{e.areaName ? ` near ${e.areaName}` : ""}
                    {e.campaignId && (
                      <Link href={`/map`} className="ml-1 text-accent">
                        hunt it
                      </Link>
                    )}
                  </>
                ) : (
                  <>
                    {formatSol(e.lamports)} fee · {formatSol(e.poolLamports)} to pool{e.onChain ? "" : " (demo)"}
                  </>
                )}
              </span>
              <span className="text-faint">{new Date(e.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, Icon }: { label: string; value: string; Icon: typeof Clock }) {
  return (
    <div className="rounded-xl bg-soft px-2 py-2">
      <div className="flex items-center justify-center gap-1 text-[10px] font-semibold text-muted">
        <Icon size={11} /> {label}
      </div>
      <div className="mt-0.5 text-sm font-bold">{value}</div>
    </div>
  );
}
