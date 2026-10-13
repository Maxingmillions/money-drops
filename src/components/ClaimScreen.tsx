"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, Share2, Check } from "lucide-react";
import { Coin } from "./Coin";
import { SolCoin } from "./SolCoin";
import { api } from "@/lib/client";
import { formatUsd } from "@/lib/geo";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { PublicDrop } from "@/lib/drops";
import { explorerTxUrl } from "@/lib/solana";

type ClaimResult = {
  amountCents: number;
  payoutStatus: string;
  payoutTxSig: string | null;
  confirmedInMs: number;
  areaName: string | null;
  campaignTitle: string;
  remaining: number;
};

const HOLD_MS = 1200;

export function ClaimScreen({ dropId }: { dropId: string }) {
  const { position } = useGeolocation();
  const [drop, setDrop] = useState<PublicDrop | null>(null);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const holdStart = useRef<number | null>(null);
  const raf = useRef<number>(0);

  useEffect(() => {
    api<{ drop: PublicDrop }>(`/api/drops/${dropId}`).then((r) => setDrop(r.drop)).catch(() => {});
  }, [dropId]);

  // Camera backdrop (best effort; the claim works without it).
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
      })
      .catch(() => {});
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  const claim = async () => {
    if (busy || !position) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<ClaimResult>(`/api/drops/${dropId}/claim`, {
        method: "POST",
        json: { lat: position.lat, lng: position.lng, accuracyM: position.accuracyM },
      });
      setResult(r);
      if (navigator.vibrate) navigator.vibrate([30, 40, 80]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
    } finally {
      setBusy(false);
    }
  };

  const startHold = () => {
    if (busy || result) return;
    holdStart.current = performance.now();
    const tick = () => {
      if (holdStart.current == null) return;
      const p = Math.min(1, (performance.now() - holdStart.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        holdStart.current = null;
        claim();
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  };
  const endHold = () => {
    holdStart.current = null;
    cancelAnimationFrame(raf.current);
    setProgress(0);
  };

  return (
    <main className="relative h-dvh overflow-hidden bg-[#2f4a36]">
      <video ref={video} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50" />

      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <Link href={`/hunt/${dropId}`} className="icon-btn">
          <X size={18} />
        </Link>
        <span className="pill bg-white/90 text-fg">
          <span className="h-2 w-2 rounded-full bg-success" /> You&apos;re here
        </span>
        <div className="w-10" />
      </div>

      {!result ? (
        <>
          <div className="absolute inset-x-0 top-[22%] z-10 flex flex-col items-center">
            <SolCoin size={210} />
            <div className="mt-6 h-2 w-36 rounded-full bg-white/30 blur-[2px]" />
            <div className="mt-8 text-center text-white drop-shadow">
              <div className="text-[26px] font-bold">
                {drop ? `${formatUsd(drop.amountCents, { compact: true })} drop` : "Drop"}
              </div>
              <div className="text-sm text-white/80">
                {drop ? `Hidden by ${drop.campaign.creator}${drop.campaign.areaName ? ` · ${drop.campaign.areaName}` : ""}` : ""}
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center pb-[calc(env(safe-area-inset-bottom)+40px)]">
            {error && <p className="mb-4 max-w-[300px] rounded-2xl bg-white/90 px-4 py-2 text-center text-sm text-danger">{error}</p>}
            {!position && <p className="mb-4 text-sm text-white/80">Waiting for your location…</p>}
            <button
              className="relative grid h-24 w-24 place-items-center rounded-full bg-white/95 shadow-xl select-none touch-none"
              onPointerDown={startHold}
              onPointerUp={endHold}
              onPointerLeave={endHold}
              onPointerCancel={endHold}
              onContextMenu={(e) => e.preventDefault()}
              disabled={!position || busy}
              aria-label="Hold to claim"
            >
              <svg className="absolute inset-0" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="46" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                <circle
                  cx="50"
                  cy="50"
                  r="46"
                  fill="none"
                  stroke="#8b3dff"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={`${progress * 289} 289`}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <Coin size={44} />
            </button>
            <div className="mt-3 text-sm font-semibold text-white drop-shadow">{busy ? "Confirming…" : "Hold to claim"}</div>
          </div>
        </>
      ) : (
        <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <div className="relative mx-auto -mb-12 w-fit">
            <SolCoin size={110} />
          </div>
          <div className="card px-5 pb-5 pt-12 text-center">
            <div className="text-[24px] font-bold">You found {formatUsd(result.amountCents, { compact: true })}</div>
            <div className="text-sm text-muted">
              {result.amountCents / 100} USDC from {drop?.campaign.creator ?? "a stranger"}
            </div>
            <div className="mt-2">
              {result.payoutStatus === "PAID" ? (
                <span className="pill bg-success-soft text-success">
                  <Check size={13} /> In your wallet
                </span>
              ) : result.payoutStatus === "FAILED" ? (
                <span className="pill bg-red-50 text-danger">Payout failed, we&apos;ll retry</span>
              ) : (
                <span className="pill bg-accent-soft text-accent">
                  <Check size={13} /> Claimed · payout pending
                </span>
              )}
            </div>
            <div className="row-list mt-4 text-left text-sm">
              <Row k="Found in" v={result.areaName ?? result.campaignTitle} />
              <Row k="Confirmed in" v={`⚡ ${(result.confirmedInMs / 1000).toFixed(1)} seconds`} />
              <Row k="Still hidden" v={`${result.remaining} drops`} />
              {result.payoutTxSig && (
                <Row
                  k="Transaction"
                  v={
                    <a className="text-accent" href={explorerTxUrl(result.payoutTxSig)} target="_blank" rel="noreferrer">
                      View ↗
                    </a>
                  }
                />
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <button
                className="btn btn-secondary flex-1"
                onClick={() =>
                  navigator.share?.({
                    title: "Money Drops",
                    text: `I just found ${formatUsd(result.amountCents, { compact: true })} hidden in ${result.areaName ?? "the wild"} on Money Drops!`,
                  }).catch(() => {})
                }
              >
                <Share2 size={16} /> Share
              </button>
              <Link href="/map" className="btn btn-primary flex-[1.4]">
                Keep hunting
              </Link>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-muted">{k}</span>
      <span className="font-semibold">{v}</span>
    </div>
  );
}
