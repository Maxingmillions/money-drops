"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Compass as CompassIcon } from "lucide-react";
import { DropMap } from "./DropMap";
import { Coin } from "./Coin";
import { api } from "@/lib/client";
import { bearingDeg, formatUsd } from "@/lib/geo";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useCompassHeading } from "@/hooks/useCompassHeading";
import type { PublicDrop } from "@/lib/drops";

export function HuntScreen({ dropId }: { dropId: string }) {
  const router = useRouter();
  const { position, error } = useGeolocation();
  const { heading, needsPermission, request } = useCompassHeading();
  const [drop, setDrop] = useState<PublicDrop | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [trend, setTrend] = useState<"warmer" | "colder" | "steady" | null>(null);
  const history = useRef<number[]>([]);

  // Re-fetch as we move so the server can reveal the exact spot when close,
  // and track whether we're getting warmer or colder.
  useEffect(() => {
    const q = position ? `?lat=${position.lat}&lng=${position.lng}` : "";
    let cancelled = false;
    api<{ drop: PublicDrop }>(`/api/drops/${dropId}${q}`)
      .then((r) => {
        if (cancelled) return;
        setDrop(r.drop);
        if (Number.isFinite(r.drop.distanceM)) {
          const h = history.current;
          h.push(r.drop.distanceM);
          if (h.length > 6) h.shift();
          if (h.length >= 3) {
            const delta = h[h.length - 1] - h[0];
            setTrend(Math.abs(delta) < 2 ? "steady" : delta < 0 ? "warmer" : "colder");
          }
        }
      })
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Couldn't load this drop"));
    return () => {
      cancelled = true;
    };
  }, [dropId, position?.lat, position?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const distance = drop && Number.isFinite(drop.distanceM) ? drop.distanceM : null;
  const bearing = drop && position ? bearingDeg(position, drop) : null;
  const relative = bearing != null && heading != null ? ((bearing - heading + 540) % 360) - 180 : null;
  const hint =
    relative == null
      ? heading == null
        ? "Point your phone and walk"
        : ""
      : Math.abs(relative) < 20
        ? "Straight ahead"
        : Math.abs(relative) > 150
          ? "It's behind you"
          : relative < 0
            ? "A little to your left"
            : "A little to your right";

  const canClaim = drop && distance != null && distance <= drop.campaign.claimRadiusM;
  const mapCenter = position ?? (drop ? { lat: drop.lat, lng: drop.lng } : { lat: 0, lng: 0 });

  return (
    <main className="page flex min-h-dvh flex-col px-5 pt-[calc(env(safe-area-inset-top)+16px)] pb-6 lg:min-h-0">
      <div className="flex items-center">
        <Link href="/map" className="icon-btn">
          <X size={18} />
        </Link>
        <div className="flex-1 text-center">
          <div className="text-[15px] font-semibold">
            {drop ? `Hunting ${formatUsd(drop.amountCents, { compact: true })}` : "Hunting"}
          </div>
          <div className="text-xs text-muted">{drop?.campaign.areaName ?? drop?.campaign.title ?? ""}</div>
        </div>
        <div className="w-10" />
      </div>

      <div className="flex flex-1 flex-col lg:mt-6 lg:grid lg:grid-cols-[420px_minmax(0,1fr)] lg:gap-8">
        {/* Compass */}
        <div className="mt-8 flex flex-col items-center lg:mt-0">
          <div className="relative h-[260px] w-[260px] rounded-full bg-elev shadow-[var(--shadow)] lg:h-[320px] lg:w-[320px]">
            {Array.from({ length: 60 }).map((_, i) => (
              <div key={i} className="absolute left-1/2 top-1/2 h-1/2 w-px origin-top" style={{ transform: `translate(-50%,0) rotate(${i * 6 + 180}deg)` }}>
                <div className={`mx-auto mt-2 w-px ${i % 15 === 0 ? "h-3 bg-fg" : "h-1.5 bg-line"}`} />
              </div>
            ))}
            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-faint">E</span>
            <span className="absolute left-1/2 top-4 -translate-x-1/2 text-[10px] font-semibold text-faint">N</span>
            {relative != null && (
              <div className="absolute left-1/2 top-1/2 h-[42%] w-px origin-top" style={{ transform: `translate(-50%,0) rotate(${relative + 180}deg)` }}>
                <div className="relative -ml-[18px] -mt-[18px] h-9 w-9" style={{ transform: `rotate(${-(relative + 180)}deg)` }}>
                  <div className="pulse-ring absolute inset-0 rounded-full bg-accent/30" />
                  <Coin size={36} />
                </div>
              </div>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[64px] font-bold leading-none tracking-tight">
                {distance == null ? "—" : distance < 1000 ? Math.round(distance) : (distance / 1000).toFixed(1)}
                <span className="ml-1 text-2xl text-muted">{distance != null && distance >= 1000 ? "km" : "m"}</span>
              </div>
              <div className="mt-2 text-sm font-semibold text-accent">
                {trend === "warmer" ? "Getting warmer" : trend === "colder" ? "Getting colder" : "Keep moving"}
              </div>
              <div className="text-xs text-muted">{hint}</div>
            </div>
          </div>

          {needsPermission && (
            <button className="btn btn-secondary mt-4 text-sm" onClick={request}>
              <CompassIcon size={16} /> Enable compass
            </button>
          )}
          {(error || loadError) && <p className="mt-3 text-center text-xs text-danger">{error ?? loadError}</p>}

          <div className="mt-6 w-full max-w-[420px] text-center text-xs text-muted">
            {drop
              ? drop.exact
                ? `Exact spot revealed. Get within ${drop.campaign.claimRadiusM} m to claim.`
                : `It's somewhere in the ${drop.campaign.searchRadiusM} m circle. The exact spot appears when you're ${drop.campaign.revealRadiusM} m away.`
              : "Loading…"}
          </div>

          <div className="mt-4 hidden w-full max-w-[420px] lg:block">
            {canClaim && (
              <button className="btn btn-primary w-full" onClick={() => router.push(`/claim/${dropId}`)}>
                You&apos;re here · Claim {formatUsd(drop!.amountCents, { compact: true })}
              </button>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="card mt-6 h-[190px] overflow-hidden lg:mt-0 lg:h-[70vh]">
          {drop && (
            <DropMap
              center={mapCenter}
              zoom={16}
              drops={[{ id: drop.id, lat: drop.lat, lng: drop.lng, amountCents: drop.amountCents, exact: drop.exact, searchRadiusM: drop.campaign.searchRadiusM }]}
              me={position}
              interactive={false}
              followKey={`${position?.lat ?? ""},${position?.lng ?? ""}`}
              attribution="top-right"
            />
          )}
        </div>
      </div>

      <div className="mt-auto pt-5 lg:hidden">
        {canClaim && (
          <button className="btn btn-primary w-full" onClick={() => router.push(`/claim/${dropId}`)}>
            You&apos;re here · Claim {formatUsd(drop!.amountCents, { compact: true })}
          </button>
        )}
      </div>
    </main>
  );
}
