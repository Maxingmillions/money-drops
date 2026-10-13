"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Lock, MapPin } from "lucide-react";
import { DropMap } from "./DropMap";
import { LocationSearch } from "./LocationSearch";
import { Coin } from "./Coin";
import { api } from "@/lib/client";
import { formatUsd, type LatLng } from "@/lib/geo";
import { useGeolocation } from "@/hooks/useGeolocation";

const FALLBACK: LatLng = { lat: 35.6717, lng: 139.6949 };
const MAX_RADIUS_M = 1600; // about a mile

/** Hide money: amount, how many drops, where, how wide. That's it. */
export function HideScreen() {
  const router = useRouter();
  const { position } = useGeolocation({ watch: false });
  const [amount, setAmount] = useState("100");
  const [count, setCount] = useState("10");
  const [center, setCenter] = useState<LatLng | null>(null);
  const [radiusM, setRadiusM] = useState(400);
  const [areaName, setAreaName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapCenter = center ?? position ?? FALLBACK;
  const totalCents = Math.max(0, Math.round(Number(amount) * 100)) || 0;
  const drops = Math.max(0, Math.floor(Number(count))) || 0;
  const perDropCents = drops > 0 ? Math.floor(totalCents / drops) : 0;
  const valid = totalCents >= 100 && drops >= 1 && perDropCents >= 100 && drops <= 5000;
  const searchRadiusM = useMemo(() => Math.min(300, Math.max(50, Math.round(radiusM / 5))), [radiusM]);

  const submit = async () => {
    setError(null);
    if (!valid) return setError(perDropCents < 100 && drops > 0 ? "Each drop needs at least $1" : "Enter an amount and a number of drops");
    const c = center ?? position;
    if (!c) return setError("Tap the map to choose where to hide the money");
    setBusy(true);
    try {
      const r = await api<{ campaign: { id: string } }>("/api/campaigns", {
        method: "POST",
        json: {
          title: areaName.trim() ? `${formatUsd(totalCents, { compact: true })} in ${areaName.trim()}` : `${formatUsd(totalCents, { compact: true })} drop`,
          kind: "PROXIMITY",
          tiers: [{ count: drops, amountCents: perDropCents }],
          centerLat: c.lat,
          centerLng: c.lng,
          radiusM,
          areaName: areaName.trim() || undefined,
          perPersonLimit: 1,
          searchRadiusM,
        },
      });
      router.push(`/campaigns/${r.campaign.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the drop");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh pb-28 lg:grid lg:min-h-0 lg:grid-cols-[440px_minmax(0,1fr)] lg:pb-0">
      <div className="relative h-[260px] w-full overflow-hidden rounded-b-[28px] lg:order-2 lg:h-dvh lg:rounded-none">
        <DropMap
          center={mapCenter}
          zoom={14}
          me={position}
          circle={{ center: mapCenter, radiusM }}
          onTap={setCenter}
          followKey={`${mapCenter.lat},${mapCenter.lng}`}
          attribution="bottom-left"
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center p-4 pt-[calc(env(safe-area-inset-top)+12px)] lg:hidden">
          <Link href="/home" className="icon-btn pointer-events-auto">
            <X size={18} />
          </Link>
          <div className="flex-1 text-center text-[15px] font-semibold">Hide money</div>
          <div className="w-10" />
        </div>
        <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+60px)] z-10 lg:left-4 lg:right-auto lg:top-4 lg:w-[380px]">
          <LocationSearch
            near={position}
            onPick={(p) => {
              setCenter({ lat: p.lat, lng: p.lng });
              if (!areaName.trim()) setAreaName(p.name);
            }}
          />
        </div>
        <div className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-fg/85 px-3 py-1.5 text-xs font-semibold text-white lg:bottom-6">
          <MapPin size={12} /> {center ? "Centre set · tap to move it" : "Search above or tap the map to set the centre"}
        </div>
      </div>

      <div className="px-5 lg:order-1 lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-line lg:bg-elev lg:px-8 lg:py-8">
        <div className="hidden items-center lg:flex">
          <Link href="/home" className="icon-btn">
            <X size={18} />
          </Link>
          <h1 className="ml-3 text-xl font-bold">Hide money</h1>
        </div>

        <div className="mt-6 text-center">
          <div className="text-[48px] font-bold leading-none tracking-tight">{formatUsd(totalCents, { compact: true })}</div>
          <div className="mt-1 text-sm text-muted">
            USDC · {drops} {drops === 1 ? "drop" : "drops"} of {formatUsd(perDropCents, { compact: true })}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <label className="row-list block px-4 py-3">
            <span className="label">Amount (USDC)</span>
            <div className="flex items-center gap-1 text-2xl font-bold">
              <span className="text-faint">$</span>
              <input className="w-full bg-transparent outline-none" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
          </label>
          <label className="row-list block px-4 py-3">
            <span className="label">Drops</span>
            <div className="flex items-center gap-2 text-2xl font-bold">
              <Coin size={22} />
              <input className="w-full bg-transparent outline-none" inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />
            </div>
          </label>
        </div>

        <div className="row-list mt-3">
          <div className="px-4 py-3">
            <input className="input" placeholder="Area name (optional, e.g. Central Park)" value={areaName} onChange={(e) => setAreaName(e.target.value)} maxLength={60} />
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Spread radius</span>
              <span className="font-semibold">
                {radiusM} m{radiusM >= 1600 ? " · ~1 mile" : radiusM >= 800 ? " · ~½ mile" : ""}
              </span>
            </div>
            <input type="range" min={50} max={MAX_RADIUS_M} step={25} value={radiusM} onChange={(e) => setRadiusM(Number(e.target.value))} className="mt-2 w-full accent-accent" />
            <p className="mt-1 text-xs text-muted">Drops are scattered inside this circle. Each one shows hunters a {searchRadiusM} m search area.</p>
          </div>
        </div>

        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}

        <button className="btn btn-primary mt-5 w-full" disabled={busy || !valid} onClick={submit}>
          <Lock size={16} /> Hide {formatUsd(totalCents, { compact: true })}
        </button>
        <p className="mt-3 text-center text-xs text-faint">One drop per person. Money goes live right away.</p>
      </div>
    </main>
  );
}
