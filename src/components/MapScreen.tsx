"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Plus, Crosshair, Sparkles, Eye, ShieldCheck, Compass, MapPin } from "lucide-react";
import { DropMap } from "./DropMap";
import { Coin } from "./Coin";
import { BottomNav } from "./BottomNav";
import { api } from "@/lib/client";
import { formatDistance, formatUsd, walkMinutes, type LatLng } from "@/lib/geo";
import { DEV_LOCATION, useGeolocation } from "@/hooks/useGeolocation";
import type { PublicDrop } from "@/lib/drops";

// Where the map opens before we have a GPS fix (matches the seed data).
const FALLBACK: LatLng = { lat: 35.6717, lng: 139.6949 };

export function MapScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { position, error, isSimulated, setSimulated } = useGeolocation();
  const [drops, setDrops] = useState<PublicDrop[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("drop"));
  const [simMode, setSimMode] = useState(false);
  const [followKey, setFollowKey] = useState(0);

  const center = position ?? FALLBACK;

  const lat = position?.lat ?? FALLBACK.lat;
  const lng = position?.lng ?? FALLBACK.lng;
  useEffect(() => {
    let cancelled = false;
    const refresh = () =>
      api<{ drops: PublicDrop[] }>(`/api/drops/nearby?lat=${lat}&lng=${lng}&radius=4000`)
        .then((r) => !cancelled && setDrops(r.drops))
        .catch(() => {});
    refresh();
    const t = setInterval(refresh, 8000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [lat, lng]);

  const selected = useMemo(() => drops.find((d) => d.id === selectedId) ?? null, [drops, selectedId]);
  const bigAmount = useMemo(() => (drops.length ? Math.max(...drops.map((d) => d.amountCents)) : undefined), [drops]);
  const total = drops.reduce((s, d) => s + d.amountCents, 0);
  const headline = selected?.campaign ?? drops[0]?.campaign ?? null;

  return (
    <main className="relative h-dvh overflow-hidden">
      <DropMap
        center={center}
        zoom={15}
        drops={drops}
        me={position}
        selectedId={selectedId}
        onSelect={setSelectedId}
        bigAmountCents={bigAmount}
        followKey={followKey}
        onTap={(p) => {
          if (simMode) setSimulated(p);
          else setSelectedId(null);
        }}
      />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 p-4 pt-[calc(env(safe-area-inset-top)+12px)]">
        <Link href="/home" className="icon-btn pointer-events-auto">
          <ChevronLeft size={20} />
        </Link>
        <div className="card pointer-events-auto flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white">
            {(headline?.creator ?? "M").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{headline?.title ?? "Nearby drops"}</div>
            <div className="truncate text-xs text-muted">
              {drops.length ? `${formatUsd(total, { compact: true })} · ${drops.length} drops around you` : "No drops within 4 km"}
            </div>
          </div>
        </div>
        <Link href="/hide" className="icon-btn pointer-events-auto">
          <Plus size={20} />
        </Link>
      </div>

      {/* Right controls */}
      <div className="absolute right-4 top-24 z-10 flex flex-col gap-2">
        <button className="icon-btn" aria-label="Centre on me" onClick={() => setFollowKey((k) => k + 1)}>
          <Crosshair size={18} />
        </button>
        {DEV_LOCATION && (
          <button
            className={`icon-btn ${simMode ? "!bg-accent !text-white" : ""}`}
            title="Dev: tap the map to simulate your location"
            onClick={() => {
              if (simMode && isSimulated) setSimulated(null);
              setSimMode((s) => !s);
            }}
          >
            <MapPin size={18} />
          </button>
        )}
      </div>

      {simMode && (
        <div className="absolute left-1/2 top-24 z-10 -translate-x-1/2 rounded-full bg-fg px-3 py-1.5 text-xs font-semibold text-white">
          Tap the map to move yourself
        </div>
      )}
      {error && !position && (
        <div className="absolute left-4 right-4 top-24 z-10 rounded-2xl bg-white/90 p-3 text-center text-xs text-muted shadow">
          {error}
        </div>
      )}

      {/* Drop sheet */}
      {selected ? (
        <div className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
          <div className="card p-5">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <div className="flex items-center gap-3">
              <Coin size={44} />
              <div>
                <div className="text-[22px] font-bold leading-tight">
                  {formatUsd(selected.amountCents, { compact: true })} drop
                </div>
                <div className="text-sm text-muted">
                  {selected.campaign.areaName ? `${selected.campaign.areaName} · ` : ""}
                  {Number.isFinite(selected.distanceM)
                    ? `${formatDistance(selected.distanceM)} · ${walkMinutes(selected.distanceM)} min walk`
                    : "distance unknown"}
                </div>
              </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-muted">
              <li className="flex items-center gap-2">
                <Sparkles size={15} className="text-faint" />
                <span>
                  <b className="text-fg">
                    {selected.campaign.bigRemaining} of {selected.campaign.bigTotal}
                  </b>{" "}
                  big drops still hidden
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Eye size={15} className="text-faint" />
                <span>
                  Exact spot shows up <b className="text-fg">{selected.campaign.revealRadiusM} m</b> away
                </span>
              </li>
              <li className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-faint" />
                <span>Only ever in public places</span>
              </li>
            </ul>
            <button className="btn btn-primary mt-5 w-full" onClick={() => router.push(`/hunt/${selected.id}`)}>
              <Compass size={18} /> Start the hunt
            </button>
          </div>
        </div>
      ) : (
        <BottomNav />
      )}
    </main>
  );
}
