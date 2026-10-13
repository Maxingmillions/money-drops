"use client";

import { useState } from "react";
import { SolAmount, SolMark } from "./Sol";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Lock, MapPin } from "lucide-react";
import { DropMap } from "./DropMap";
import { MobileBar } from "./MobileBar";
import { LocationSearch } from "./LocationSearch";
import { Coin } from "./Coin";
import { api } from "@/lib/client";
import { formatSol, solToLamports, type LatLng } from "@/lib/geo";
import { useGeolocation } from "@/hooks/useGeolocation";

const FALLBACK: LatLng = { lat: 35.6717, lng: 139.6949 };
const MAX_RADIUS_M = 100_000; // slider goes to 5 km; type anything up to 100 km

/** Hide money: amount, how many drops, where, how wide. That's it. */
export function HideScreen() {
  const router = useRouter();
  const { position } = useGeolocation({ watch: false });
  const [amount, setAmount] = useState("1");
  const [count, setCount] = useState("10");
  const [center, setCenter] = useState<LatLng | null>(null);
  const [radiusM, setRadiusM] = useState(400);
  const [searchRadiusM, setSearchRadiusM] = useState(80);
  const [areaName, setAreaName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapCenter = center ?? position ?? FALLBACK;
  const totalLamports = Math.max(0, solToLamports(Number(amount) || 0));
  const drops = Math.max(0, Math.floor(Number(count))) || 0;
  const perDropLamports = drops > 0 ? Math.floor(totalLamports / drops) : 0;
  const MIN_DROP = 1_000_000; // 0.001 SOL
  const valid = totalLamports >= MIN_DROP && drops >= 1 && perDropLamports >= MIN_DROP && drops <= 5000;
  const clampedRadius = Math.min(MAX_RADIUS_M, Math.max(20, Math.round(radiusM) || 20));
  const clampedSearch = Math.min(2000, Math.max(40, Math.round(searchRadiusM) || 40));

  const submit = async () => {
    setError(null);
    if (!valid) return setError(perDropLamports < MIN_DROP && drops > 0 ? "Each drop needs at least 0.001 SOL" : "Enter an amount and a number of drops");
    const c = center ?? position;
    if (!c) return setError("Tap the map to choose where to hide the money");
    setBusy(true);
    try {
      const r = await api<{ campaign: { id: string; status: string } }>("/api/campaigns", {
        method: "POST",
        json: {
          title: areaName.trim() ? `${formatSol(totalLamports)} in ${areaName.trim()}` : `${formatSol(totalLamports)} drop`,
          kind: "PROXIMITY",
          tiers: [{ count: drops, amountLamports: perDropLamports }],
          centerLat: c.lat,
          centerLng: c.lng,
          radiusM: clampedRadius,
          areaName: areaName.trim() || undefined,
          perPersonLimit: 1,
          searchRadiusM: clampedSearch,
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
      <MobileBar href="/home" title="Hide money" icon={<X size={18} />} />
      <div className="relative mx-3 h-[300px] overflow-hidden rounded-[28px] lg:order-2 lg:mx-0 lg:h-dvh lg:rounded-none">
        <DropMap
          center={mapCenter}
          zoom={14}
          me={position}
          circle={{ center: mapCenter, radiusM: clampedRadius }}
          onTap={setCenter}
          followKey={`${mapCenter.lat},${mapCenter.lng}`}
          attribution="bottom-right"
        />
        <div className="absolute inset-x-3 top-3 z-10 lg:left-4 lg:right-auto lg:top-4 lg:w-[380px]">
          <LocationSearch
            near={position}
            onPick={(p) => {
              setCenter({ lat: p.lat, lng: p.lng });
              if (!areaName.trim()) setAreaName(p.name);
            }}
          />
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 flex max-w-[calc(100%-56px)] items-center gap-1.5 rounded-full bg-fg/85 px-3 py-1.5 text-[11px] font-semibold text-white lg:bottom-6 lg:left-1/2 lg:-translate-x-1/2 lg:text-xs">
          <MapPin size={12} className="shrink-0" /> <span className="truncate">{center ? "Centre set · tap to move it" : "Search above or tap the map to set the centre"}</span>
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
          <div className="text-[48px] font-bold leading-none tracking-tight"><SolAmount lamports={totalLamports} /></div>
          <div className="mt-1 text-sm text-muted">
            {drops} {drops === 1 ? "drop" : "drops"} of {formatSol(perDropLamports)}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <label className="row-list block px-4 py-3">
            <span className="label">Amount (SOL)</span>
            <div className="flex items-center gap-1 text-2xl font-bold">
              <SolMark className="opacity-70" />
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
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted">Spread radius</span>
              <RadiusInput value={radiusM} onChange={setRadiusM} max={MAX_RADIUS_M} />
            </div>
            <input type="range" min={50} max={5000} step={25} value={Math.min(5000, radiusM)} onChange={(e) => setRadiusM(Number(e.target.value))} className="mt-2 w-full accent-accent" />
            <p className="mt-1 text-xs text-muted">Drops are scattered inside this circle. Type any distance up to 100 km.</p>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <span className="text-muted">Search circle per drop</span>
            <RadiusInput value={searchRadiusM} onChange={setSearchRadiusM} max={2000} />
          </div>
        </div>

        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}

        <button className="btn btn-primary mt-5 w-full" disabled={busy || !valid} onClick={submit}>
          <Lock size={16} /> Hide <SolAmount lamports={totalLamports} />
        </button>
        <p className="mt-3 text-center text-xs text-faint">One drop per person. Wallet accounts pay the amount plus a 5% fee on the next screen (half of the fee fills the community drop pool). Unclaimed drops come back to you.</p>
      </div>
    </main>
  );
}

/** Metres input with km shorthand when large. */
export function RadiusInput({ value, onChange, max }: { value: number; onChange: (v: number) => void; max: number }) {
  return (
    <span className="flex items-center gap-1 font-semibold">
      <input
        className="input !w-24 !py-1 text-right"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(0, Number(e.target.value.replace(/[^0-9]/g, "")) || 0)))}
      />
      <span className="text-muted">m{value >= 1000 ? ` · ${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)} km` : ""}</span>
    </span>
  );
}
