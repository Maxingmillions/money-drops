"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Check, Copy } from "lucide-react";
import { DropMap } from "./DropMap";
import { Coin } from "./Coin";
import { FundWithWallet } from "./FundWithWallet";
import { PRIVY_APP_ID } from "./Providers";
import { api } from "@/lib/client";
import { formatUsd } from "@/lib/geo";
import { explorerTxUrl } from "@/lib/solana";

export type CampaignDetail = {
  campaign: {
    id: string;
    title: string;
    kind: string;
    status: string;
    totalCents: number;
    claimedCents: number;
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
    tiers: { amountCents: number; count: number; remaining: number }[];
    drops: { amountCents: number; status: string; lat: number; lng: number }[];
  };
  funding: { treasury: string | null; memo: string; amountCents: number } | null;
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
  const drops = c.drops.map((d, i) => ({ id: String(i), lat: d.lat, lng: d.lng, amountCents: d.amountCents }));
  const big = Math.max(...c.tiers.map((t) => t.amountCents));

  return (
    <main className="min-h-dvh pb-10">
      <div className="h-[220px] overflow-hidden rounded-b-[28px]">
        <DropMap
          center={{ lat: c.centerLat, lng: c.centerLng }}
          zoom={14}
          drops={drops.filter((_, i) => c.drops[i].status === "HIDDEN")}
          bigAmountCents={big}
          circle={{ center: { lat: c.centerLat, lng: c.centerLng }, radiusM: c.radiusM }}
        />
      </div>
      <div className="px-5">
        <div className="-mt-5 flex items-center">
          <Link href="/home" className="icon-btn">
            <ChevronLeft size={18} />
          </Link>
          <div className="flex-1 text-center text-[15px] font-semibold">{c.title}</div>
          <div className="w-10" />
        </div>

        <div className="mt-6 text-center">
          <div className="text-[44px] font-bold leading-none tracking-tight">{formatUsd(c.totalCents, { compact: true })}</div>
          <div className="mt-1 text-sm text-muted">
            {c.remaining} of {c.dropCount} drops still hidden · {formatUsd(c.claimedCents, { compact: true })} found
          </div>
          <div className="mt-3">
            <StatusPill status={c.status} />
          </div>
        </div>

        {data.funding && (
          <section className="card mt-6 p-4">
            <h3 className="text-sm font-semibold">Fund this drop to make it live</h3>
            <p className="mt-1 text-xs text-muted">
              Send {formatUsd(data.funding.amountCents)} USDC to the Money Drops escrow with your campaign id as the memo.
              Unclaimed money is returned to you.
            </p>
            {PRIVY_APP_ID && data.funding.treasury ? (
              <FundWithWallet campaignId={c.id} amountCents={data.funding.amountCents} treasury={data.funding.treasury} onFunded={load} />
            ) : (
              <ManualFunding campaignId={c.id} treasury={data.funding.treasury} onFunded={load} />
            )}
          </section>
        )}

        <h3 className="mt-6 mb-2 text-sm font-semibold">Drops</h3>
        <div className="row-list text-sm">
          {c.tiers.map((t) => (
            <div key={t.amountCents} className="flex items-center gap-3 px-4 py-3">
              <Coin size={22} />
              <span>
                {t.count} {t.count === 1 ? "drop" : "drops"} of {formatUsd(t.amountCents, { compact: true })}
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

function ManualFunding({ campaignId, treasury, onFunded }: { campaignId: string; treasury: string | null; onFunded: () => void }) {
  const [sig, setSig] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (k: string, v: string) => {
    await navigator.clipboard.writeText(v).catch(() => {});
    setCopied(k);
    setTimeout(() => setCopied(null), 1200);
  };
  if (!treasury) {
    return <p className="mt-3 text-xs text-danger">Escrow wallet isn&apos;t configured on this server (NEXT_PUBLIC_TREASURY_ADDRESS).</p>;
  }
  return (
    <div className="mt-3 space-y-2 text-xs">
      <button className="flex w-full items-center justify-between rounded-xl bg-soft px-3 py-2 font-mono" onClick={() => copy("t", treasury)}>
        <span className="truncate">{treasury}</span>
        {copied === "t" ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <button className="flex w-full items-center justify-between rounded-xl bg-soft px-3 py-2 font-mono" onClick={() => copy("m", campaignId)}>
        <span className="truncate">memo: {campaignId}</span>
        {copied === "m" ? <Check size={14} /> : <Copy size={14} />}
      </button>
      <input className="input !text-xs" placeholder="Paste the transaction signature" value={sig} onChange={(e) => setSig(e.target.value.trim())} />
      <button
        className="btn btn-primary w-full !py-3 text-sm"
        disabled={busy || sig.length < 64}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          try {
            await api(`/api/campaigns/${campaignId}/fund`, { method: "POST", json: { signature: sig } });
            onFunded();
          } catch (e) {
            setMsg(e instanceof Error ? e.message : "Verification failed");
          } finally {
            setBusy(false);
          }
        }}
      >
        Verify deposit
      </button>
      {msg && <p className="text-danger">{msg}</p>}
    </div>
  );
}
