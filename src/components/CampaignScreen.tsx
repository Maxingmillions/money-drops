"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DropMap } from "./DropMap";
import { Coin } from "./Coin";
import { FundWithWallet } from "./FundWithWallet";
import { api } from "@/lib/client";
import { formatSol } from "@/lib/geo";
import { explorerTxUrl } from "@/lib/solana";

export type CampaignDetail = {
  campaign: {
    id: string;
    title: string;
    kind: string;
    status: string;
    totalLamports: number;
    claimedLamports: number;
    perPersonLimit: number;
    centerLat: number;
    centerLng: number;
    radiusM: number;
    areaName: string | null;
    startsAt: string | null;
    endsAt: string | null;
    fundingTxSig: string | null;
    dropCount: number;
    remaining: number;
    bigRemaining: number;
    bigTotal: number;
    tiers: { amountLamports: number; count: number; remaining: number }[];
    drops: { amountLamports: number; status: string; lat: number; lng: number }[];
  };
  funding: { treasury: string | null; memo: string; lamports: number; feeLamports: number; wallet: string } | null;
};

export function CampaignScreen({ id }: { id: string }) {
  const [data, setData] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<CampaignDetail>(`/api/campaigns/${id}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load"));
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [load]);

  if (error) return <main className="p-6 text-center text-sm text-danger">{error}</main>;
  if (!data) return <main className="p-6 text-center text-sm text-muted">Loading…</main>;
  const c = data.campaign;
  const drops = c.drops.map((d, i) => ({ id: String(i), lat: d.lat, lng: d.lng, amountLamports: d.amountLamports }));
  const big = Math.max(...c.tiers.map((t) => t.amountLamports));

  return (
    <main className="min-h-dvh pb-28 lg:grid lg:min-h-0 lg:grid-cols-[480px_minmax(0,1fr)] lg:pb-0">
      <div className="relative h-[220px] overflow-hidden rounded-b-[28px] lg:order-2 lg:h-dvh lg:rounded-none">
        <DropMap
          center={{ lat: c.centerLat, lng: c.centerLng }}
          zoom={14}
          drops={drops.filter((_, i) => c.drops[i].status === "HIDDEN")}
          bigAmountCents={big}
          circle={{ center: { lat: c.centerLat, lng: c.centerLng }, radiusM: c.radiusM }}
          attribution="bottom-right"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center p-4 pt-[calc(env(safe-area-inset-top)+12px)] lg:hidden">
          <Link href="/home" className="icon-btn pointer-events-auto">
            <ChevronLeft size={18} />
          </Link>
          <div className="flex-1 truncate text-center text-[15px] font-semibold">{c.title}</div>
          <div className="w-10" />
        </div>
      </div>
      <div className="px-5 lg:order-1 lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-line lg:bg-elev lg:px-8 lg:py-8">
        <div className="hidden items-center lg:flex">
          <Link href="/home" className="icon-btn">
            <ChevronLeft size={18} />
          </Link>
          <h1 className="ml-3 truncate text-xl font-bold">{c.title}</h1>
        </div>

        <div className="mt-6 text-center">
          <div className="text-[44px] font-bold leading-none tracking-tight">{formatSol(c.totalLamports, { compact: true })}</div>
          <div className="mt-1 text-sm text-muted">
            {c.remaining} of {c.dropCount} drops still hidden · {formatSol(c.claimedLamports, { compact: true })} found
          </div>
          <div className="mt-3">
            <StatusPill status={c.status} />
          </div>
        </div>

        {data.funding && (
          <section className="card mt-6 p-4">
            <h3 className="text-sm font-semibold">Pay to make this hunt live</h3>
            <p className="mt-1 text-xs text-muted">
              {formatSol(data.funding.lamports)} from your wallet: the hunt plus a {formatSol(data.funding.feeLamports)} fee (half of every fee feeds the community drop pool). Unclaimed drops come back to you.
            </p>
            {data.funding.treasury ? (
              <FundWithWallet memo={c.id} lamports={data.funding.lamports} treasury={data.funding.treasury} wallet={data.funding.wallet} fundPath={`/api/campaigns/${c.id}/fund`} onFunded={load} />
            ) : (
              <p className="mt-2 text-xs text-danger">Escrow wallet isn&apos;t configured on this server.</p>
            )}
          </section>
        )}

        <h3 className="mt-6 mb-2 text-sm font-semibold">Drops</h3>
        <div className="row-list text-sm">
          {c.tiers.map((t) => (
            <div key={t.amountLamports} className="flex items-center gap-3 px-4 py-3">
              <Coin size={22} />
              <span>
                {t.count} {t.count === 1 ? "drop" : "drops"} of {formatSol(t.amountLamports, { compact: true })}
              </span>
              <span className="ml-auto text-muted">{t.remaining} left</span>
            </div>
          ))}
        </div>

        <h3 className="mt-6 mb-2 text-sm font-semibold">Details</h3>
        <div className="row-list text-sm">
          <Row k="Type" v={c.kind === "EVENT" ? "Event drop" : "Proximity drop"} />
          {c.areaName && <Row k="Area" v={c.areaName} />}
          <Row k="Radius" v={`${c.radiusM} m`} />
          {c.startsAt && <Row k="Starts" v={new Date(c.startsAt).toLocaleString()} />}
          {c.endsAt && <Row k="Ends" v={new Date(c.endsAt).toLocaleString()} />}
          <Row k="Each person" v={c.perPersonLimit === 1 ? "One drop" : `Up to ${c.perPersonLimit}`} />
          {c.fundingTxSig && (
            <Row
              k="Escrow deposit"
              v={
                <a className="text-accent" href={explorerTxUrl(c.fundingTxSig)} target="_blank" rel="noreferrer">
                  View ↗
                </a>
              }
            />
          )}
        </div>

        {c.status === "ACTIVE" && (
          <Link href={`/map`} className="btn btn-secondary mt-6 w-full">
            See it on the map
          </Link>
        )}
      </div>
    </main>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-amber-50 text-amber-700",
    ACTIVE: "bg-success-soft text-success",
    ENDED: "bg-soft text-muted",
    REFUNDED: "bg-soft text-muted",
  };
  const label: Record<string, string> = { DRAFT: "Waiting for funding", ACTIVE: "Live", ENDED: "Ended", REFUNDED: "Refunded" };
  return <span className={`pill ${map[status] ?? "bg-soft"}`}>{label[status] ?? status}</span>;
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-muted">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
