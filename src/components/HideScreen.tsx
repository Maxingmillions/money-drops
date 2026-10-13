"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Trash2, Plus, Lock } from "lucide-react";
import { DropMap } from "./DropMap";
import { Coin } from "./Coin";
import { api } from "@/lib/client";
import { formatUsd, type LatLng } from "@/lib/geo";
import { useGeolocation } from "@/hooks/useGeolocation";

type TierRow = { count: string; amount: string };

const FALLBACK: LatLng = { lat: 35.6717, lng: 139.6949 };

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function HideScreen() {
  const router = useRouter();
  const { position } = useGeolocation({ watch: false });
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"PROXIMITY" | "EVENT">("PROXIMITY");
  const [tiers, setTiers] = useState<TierRow[]>([
    { count: "20", amount: "5" },
    { count: "5", amount: "20" },
    { count: "1", amount: "100" },
  ]);
  const [center, setCenter] = useState<LatLng | null>(null);
  const [radiusM, setRadiusM] = useState(400);
  const [areaName, setAreaName] = useState("");
  const [perPerson, setPerPerson] = useState(1);
  const [startsAt, setStartsAt] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60_000)));
  const [endsAt, setEndsAt] = useState(() => toLocalInput(new Date(Date.now() + 9 * 60 * 60_000)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapCenter = center ?? position ?? FALLBACK;
  const parsed = useMemo(
    () =>
      tiers
        .map((t) => ({ count: Math.floor(Number(t.count)), amountCents: Math.round(Number(t.amount) * 100) }))
        .filter((t) => t.count > 0 && t.amountCents >= 100),
    [tiers],
  );
  const totalCents = parsed.reduce((s, t) => s + t.count * t.amountCents, 0);
  const dropCount = parsed.reduce((s, t) => s + t.count, 0);

  const submit = async () => {
    setError(null);
    if (!title.trim()) return setError("Give your drop a name");
    if (parsed.length === 0) return setError("Add at least one drop tier");
    const c = center ?? position;
    if (!c) return setError("Tap the map to choose where to hide the drops");
    setBusy(true);
    try {
      const r = await api<{ campaign: { id: string } }>("/api/campaigns", {
        method: "POST",
        json: {
          title: title.trim(),
          kind,
          tiers: parsed,
          centerLat: c.lat,
          centerLng: c.lng,
          radiusM,
          areaName: areaName.trim() || undefined,
          perPersonLimit: perPerson,
          ...(kind === "EVENT"
            ? { startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() }
            : {}),
        },
      });
      router.push(`/campaigns/${r.campaign.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the drop");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh pb-10">
      <div className="h-[200px] w-full overflow-hidden rounded-b-[28px]">
        <DropMap
          center={mapCenter}
          zoom={14}
          me={position}
          circle={{ center: mapCenter, radiusM }}
          onTap={setCenter}
          followKey={`${mapCenter.lat},${mapCenter.lng}`}
        />
      </div>

      <div className="px-5">
        <div className="-mt-5 flex items-center">
          <Link href="/home" className="icon-btn">
            <X size={18} />
          </Link>
          <div className="flex-1 text-center text-[15px] font-semibold">Hide money</div>
          <div className="w-10" />
        </div>

        <div className="mt-6 text-center">
          <div className="text-[48px] font-bold leading-none tracking-tight">{formatUsd(totalCents, { compact: true })}</div>
          <div className="mt-1 text-sm text-muted">USDC, hidden in {dropCount.toLocaleString()} drops</div>
        </div>

        <input
          className="input mt-6"
          placeholder="Name your drop (e.g. Saturday park hunt)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={60}
        />

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-soft p-1">
          {(["PROXIMITY", "EVENT"] as const).map((k) => (
            <button
              key={k}
              className={`rounded-xl py-2 text-sm font-semibold transition ${kind === k ? "bg-elev shadow" : "text-muted"}`}
              onClick={() => setKind(k)}
            >
              {k === "PROXIMITY" ? "Proximity drop" : "Event drop"}
            </button>
          ))}
        </div>
        <p className="mt-2 px-1 text-xs text-muted">
          {kind === "PROXIMITY"
            ? "Live right away. Anyone who walks up to a drop can claim it."
            : "Only visible and claimable during a time window. Unclaimed drops come back to you."}
        </p>

        <h3 className="mt-6 mb-2 text-sm font-semibold">Drops</h3>
        <div className="row-list">
          {tiers.map((t, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
              <Coin size={22} />
              <input
                className="input !w-16 !px-1 !py-1.5 text-center"
                inputMode="numeric"
                value={t.count}
                onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, count: e.target.value } : x)))}
              />
              <span className="whitespace-nowrap text-muted">× $</span>
              <input
                className="input !w-16 !px-1 !py-1.5 text-center"
                inputMode="decimal"
                value={t.amount}
                onChange={(e) => setTiers(tiers.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))}
              />
              <span className="ml-auto whitespace-nowrap font-semibold">
                {formatUsd(Math.max(0, Math.floor(Number(t.count)) * Math.round(Number(t.amount) * 100)) || 0, { compact: true })}
              </span>
              <button className="text-faint" onClick={() => setTiers(tiers.filter((_, j) => j !== i))} aria-label="Remove tier">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          {tiers.length < 5 && (
            <button
              className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-accent"
              onClick={() => setTiers([...tiers, { count: "10", amount: "5" }])}
            >
              <Plus size={16} /> Add a tier
            </button>
          )}
        </div>

        <h3 className="mt-6 mb-2 text-sm font-semibold">Where</h3>
        <div className="row-list">
          <div className="px-4 py-3">
            <input className="input" placeholder="Area name (e.g. Yoyogi Park)" value={areaName} onChange={(e) => setAreaName(e.target.value)} maxLength={60} />
            <p className="mt-2 text-xs text-muted">
              {center ? "Centre set from the map." : "Tap the map above to set the centre."} Drops are scattered inside the circle.
            </p>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted">Radius</span>
            <div className="flex items-center gap-3">
              <input type="range" min={50} max={2000} step={50} value={radiusM} onChange={(e) => setRadiusM(Number(e.target.value))} />
              <span className="w-14 text-right font-semibold">{radiusM} m</span>
            </div>
          </div>
        </div>

        <h3 className="mt-6 mb-2 text-sm font-semibold">Rules</h3>
        <div className="row-list text-sm">
          {kind === "EVENT" && (
            <>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-muted">Starts</span>
                <input type="datetime-local" className="input !w-auto !py-1" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-muted">Ends</span>
                <input type="datetime-local" className="input !w-auto !py-1" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </>
          )}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-muted">Each person</span>
            <select className="input !w-auto !py-1" value={perPerson} onChange={(e) => setPerPerson(Number(e.target.value))}>
              {[1, 2, 3, 5, 10].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "One drop" : `Up to ${n} drops`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-muted">{kind === "EVENT" ? "Not found by the end" : "Not found"}</span>
            <span className="font-semibold">{kind === "EVENT" ? "Back to you" : "Stays hidden"}</span>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          Drops only go in public places. Roads, rail lines and private property are left out for you.
        </p>

        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}

        <button className="btn btn-primary mt-4 w-full" disabled={busy || totalCents === 0} onClick={submit}>
          <Lock size={16} /> Hide {formatUsd(totalCents, { compact: true })}
        </button>
      </div>
    </main>
  );
}
