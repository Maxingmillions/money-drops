"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SolAmount, SolMark } from "./Sol";
import Link from "next/link";
import { X, Share2, Check, Wallet, ChevronLeft, ChevronRight, Compass, Footprints } from "lucide-react";
import { Coin } from "./Coin";
import { SolCoin } from "./SolCoin";
import { api } from "@/lib/client";
import { bearingDeg, distanceM, formatSol } from "@/lib/geo";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useCompassHeading } from "@/hooks/useCompassHeading";
import type { PublicDrop } from "@/lib/drops";
import { explorerTxUrl } from "@/lib/solana";

type ClaimResult = {
  amountLamports: number;
  payoutStatus: string;
  payoutTxSig: string | null;
  confirmedInMs: number;
  areaName: string | null;
  campaignTitle: string;
  remaining: number;
};

const HOLD_MS = 1200;
/** Half of the horizontal field of view we assume for a phone camera in portrait. */
const HALF_FOV = 32;
/** Coin sits at this height of the screen whatever the phone's pitch is. */
const COIN_Y = 44;

type Phase = "scan" | "flying" | "done";

/**
 * AR-style claim: the camera is the backdrop, the coin is drawn where the
 * drop is relative to the compass heading, and holding the button pulls the
 * coin into the wallet.
 */
export function ClaimScreen({ dropId }: { dropId: string }) {
  const { position } = useGeolocation();
  const { heading, needsPermission, request } = useCompassHeading();
  const [drop, setDrop] = useState<PublicDrop | null>(null);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>("scan");
  const [fly, setFly] = useState<{ dx: number; dy: number } | null>(null);
  const [cameraOk, setCameraOk] = useState<boolean | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const coinEl = useRef<HTMLDivElement>(null);
  const walletEl = useRef<HTMLDivElement>(null);
  const holdStart = useRef<number | null>(null);
  const raf = useRef<number>(0);
  const smooth = useRef<number | null>(null);

  // Fetch the drop with our position so the server reveals the exact spot
  // (inside the reveal radius) instead of the fuzzed one. Refetch on a coarse grid.
  const posKey = position ? `${position.lat.toFixed(4)},${position.lng.toFixed(4)}` : "";
  useEffect(() => {
    const q = position ? `?lat=${position.lat}&lng=${position.lng}` : "";
    api<{ drop: PublicDrop }>(`/api/drops/${dropId}${q}`).then((r) => setDrop(r.drop)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dropId, posKey]);

  // Camera backdrop (best effort; the claim works without it).
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((s) => {
        stream = s;
        if (video.current) video.current.srcObject = s;
        setCameraOk(true);
      })
      .catch(() => setCameraOk(false));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  // Where the drop is relative to where the phone points, smoothed so the coin doesn't jitter.
  const dist = drop && position ? distanceM(position, drop) : null;
  const bearing = drop && position ? bearingDeg(position, drop) : null;
  const rawRelative = bearing != null && heading != null ? ((bearing - heading + 540) % 360) - 180 : null;
  const rawRef = useRef<number | null>(null);
  useEffect(() => {
    rawRef.current = rawRelative;
  }, [rawRelative]);
  const [relative, setRelative] = useState<number | null>(null);
  // Ease towards the true angle every frame so the coin glides instead of jumping.
  useEffect(() => {
    let frame = 0;
    const step = () => {
      const target = rawRef.current;
      if (target != null) {
        const prev = smooth.current;
        const next = prev == null ? target : prev + (((target - prev + 540) % 360) - 180) * 0.18;
        const wrapped = ((next + 540) % 360) - 180;
        if (prev == null || Math.abs(wrapped - prev) > 0.05) {
          smooth.current = wrapped;
          setRelative(wrapped);
        }
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, []);

  const hasCompass = heading != null;
  const inView = !hasCompass || (relative != null && Math.abs(relative) <= HALF_FOV);
  const claimRadius = drop?.campaign.claimRadiusM ?? 15;
  const closeEnough = dist != null && dist <= claimRadius;
  const canClaim = Boolean(position && drop && inView && closeEnough && phase === "scan");

  // Horizontal position of the coin on screen and its size by distance.
  const coinX = useMemo(() => {
    if (!hasCompass || relative == null) return 50;
    return 50 + (Math.max(-HALF_FOV, Math.min(HALF_FOV, relative)) / HALF_FOV) * 42;
  }, [hasCompass, relative]);
  const coinScale = dist == null ? 1 : Math.max(0.55, Math.min(1.3, 1.3 - (dist / Math.max(claimRadius, 1)) * 0.6));

  const claim = useCallback(async () => {
    if (!position) return;
    setError(null);
    // Launch the coin towards the wallet while the server confirms.
    const c = coinEl.current?.getBoundingClientRect();
    const w = walletEl.current?.getBoundingClientRect();
    if (c && w) setFly({ dx: w.left + w.width / 2 - (c.left + c.width / 2), dy: w.top + w.height / 2 - (c.top + c.height / 2) });
    setPhase("flying");
    if (navigator.vibrate) navigator.vibrate([20, 30, 60]);
    try {
      const [r] = await Promise.all([
        api<ClaimResult>(`/api/drops/${dropId}/claim`, {
          method: "POST",
          json: { lat: position.lat, lng: position.lng, accuracyM: position.accuracyM },
        }),
        new Promise((res) => setTimeout(res, 1000)),
      ]);
      setResult(r);
      setPhase("done");
      if (navigator.vibrate) navigator.vibrate([30, 40, 120]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Claim failed");
      setFly(null);
      setPhase("scan");
    }
  }, [dropId, position]);

  const startHold = () => {
    if (!canClaim) return;
    holdStart.current = performance.now();
    const tick = () => {
      if (holdStart.current == null) return;
      const p = Math.min(1, (performance.now() - holdStart.current) / HOLD_MS);
      setProgress(p);
      if (p >= 1) {
        holdStart.current = null;
        setProgress(0);
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

  const hint = (() => {
    if (!drop) return "Loading the drop…";
    if (!position) return "Waiting for your location…";
    if (needsPermission) return "Allow motion access to scan for the coin";
    if (!closeEnough) return `Get closer · ${Math.round(dist!)} m away`;
    if (!hasCompass) return "No compass on this device · the coin is right here";
    if (!inView) return relative! < 0 ? `Turn left ${Math.round(-relative!)}°` : `Turn right ${Math.round(relative!)}°`;
    return "Coin found · hold to claim";
  })();

  return (
    <main className="relative h-dvh overflow-hidden bg-[#1b1430]">
      <video ref={video} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" />
      {cameraOk === false && <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,#3b1d7a,#120a26)]" />}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
      {/* Scan grid: a faint reticle so it reads as "scanning" */}
      {phase === "scan" && <div className="pointer-events-none absolute inset-0 opacity-30 [background:radial-gradient(circle_at_50%_44%,transparent_120px,rgba(0,0,0,.35)_121px)]" />}

      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <Link href={`/hunt/${dropId}`} className="icon-btn">
          <X size={18} />
        </Link>
        <span className="pill bg-white/90 text-fg">
          <Footprints size={13} /> {dist != null ? `${Math.round(dist)} m` : "…"}
        </span>
        <div ref={walletEl} className={`grid h-10 w-10 place-items-center rounded-full bg-white/95 text-accent shadow-lg transition-transform ${phase !== "scan" ? "scale-110 ring-4 ring-accent/40" : ""}`} aria-label="Your wallet">
          <Wallet size={18} />
        </div>
      </div>

      {phase !== "done" ? (
        <>
          {/* Off-screen direction arrows */}
          {phase === "scan" && hasCompass && !inView && relative != null && (
            <div className={`absolute top-[${COIN_Y}%] z-10 -translate-y-1/2 ${relative < 0 ? "left-3" : "right-3"} grid h-14 w-14 animate-pulse place-items-center rounded-full bg-white/90 text-accent shadow-lg`} style={{ top: `${COIN_Y}%` }}>
              {relative < 0 ? <ChevronLeft size={28} /> : <ChevronRight size={28} />}
            </div>
          )}

          {/* The coin, placed by compass bearing */}
          <div
            ref={coinEl}
            className="absolute z-10 flex flex-col items-center"
            style={{
              left: `${coinX}%`,
              top: `${COIN_Y}%`,
              transform: fly
                ? `translate(calc(-50% + ${fly.dx}px), calc(-50% + ${fly.dy}px)) scale(0.12)`
                : `translate(-50%, -50%) scale(${coinScale})`,
              opacity: phase === "scan" ? (inView ? 1 : 0.25) : fly ? 0.9 : 1,
              transition: fly ? "transform 0.9s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.9s" : "left 0.15s linear, transform 0.3s ease, opacity 0.3s",
              filter: closeEnough || dist == null ? "none" : "saturate(0.6)",
            }}
          >
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-[#9945ff]/40 blur-3xl" />
              <SolCoin size={220} />
            </div>
            {phase === "scan" && (
              <div className="mt-2 rounded-full bg-black/60 px-3 py-1 text-sm font-bold text-white backdrop-blur">
                <SolMark /> {drop ? formatSol(drop.amountLamports, { compact: true }) : "…"}
              </div>
            )}
          </div>

          {/* "+0.02" pops at the wallet once the coin lands */}
          {phase === "flying" && drop && (
            <div className="pop-in absolute right-3 top-[calc(env(safe-area-inset-top)+60px)] z-20 rounded-full bg-success-soft px-3 py-1 text-sm font-bold text-success shadow">
              +{formatSol(drop.amountLamports)}
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center pb-[calc(env(safe-area-inset-bottom)+36px)]">
            {error && <p className="mb-4 max-w-[300px] rounded-2xl bg-white/90 px-4 py-2 text-center text-sm text-danger">{error}</p>}
            <div className="mb-4 max-w-[320px] text-center text-sm font-semibold text-white drop-shadow">
              {drop && (
                <div className="mb-1 text-xs font-medium text-white/75">
                  Hidden by {drop.campaign.creator}
                  {drop.campaign.areaName ? ` · ${drop.campaign.areaName}` : ""}
                </div>
              )}
              {hint}
            </div>
            {needsPermission ? (
              <button className="btn btn-primary" onClick={request}>
                <Compass size={16} /> Start scanning
              </button>
            ) : (
              <>
                <button
                  className={`relative grid h-24 w-24 place-items-center rounded-full shadow-xl select-none touch-none transition ${canClaim ? "bg-white/95" : "bg-white/50"}`}
                  onPointerDown={startHold}
                  onPointerUp={endHold}
                  onPointerLeave={endHold}
                  onPointerCancel={endHold}
                  onContextMenu={(e) => e.preventDefault()}
                  disabled={!canClaim}
                  aria-label="Hold to claim"
                >
                  <svg className="absolute inset-0" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                    <circle cx="50" cy="50" r="46" fill="none" stroke="#8b3dff" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${progress * 289} 289`} transform="rotate(-90 50 50)" />
                  </svg>
                  <Coin size={44} />
                </button>
                <div className="mt-3 text-sm font-semibold text-white drop-shadow">{phase === "flying" ? "Sending to your wallet…" : "Hold to claim"}</div>
              </>
            )}
          </div>
        </>
      ) : (
        result && (
          <div className="absolute inset-x-0 bottom-0 z-10 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
            <div className="relative mx-auto -mb-12 w-fit">
              <SolCoin size={110} />
            </div>
            <div className="card pop-in px-5 pb-5 pt-12 text-center">
              <div className="text-[24px] font-bold">
                You found <SolAmount lamports={result.amountLamports} />
              </div>
              <div className="text-sm text-muted">
                {formatSol(result.amountLamports)} from {drop?.campaign.creator ?? "a stranger"}
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
                      title: "Drops",
                      text: `I just found ${formatSol(result.amountLamports)} hidden in ${result.areaName ?? "the wild"} on Drops!`,
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
        )
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
