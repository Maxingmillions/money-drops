"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, Lock, MapPin } from "lucide-react";
import { DropMap } from "./DropMap";
import { api } from "@/lib/client";
import { formatUsd, type LatLng } from "@/lib/geo";
import { useGeolocation } from "@/hooks/useGeolocation";

const FALLBACK: LatLng = { lat: 35.6717, lng: 139.6949 };

export function NewBountyScreen() {
  const router = useRouter();
  const { position } = useGeolocation({ watch: false });
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("25");
  const [winners, setWinners] = useState(1);
  const [useLocation, setUseLocation] = useState(true);
  const [center, setCenter] = useState<LatLng | null>(null);
  const [radiusM, setRadiusM] = useState(200);
  const [areaName, setAreaName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mapCenter = center ?? position ?? FALLBACK;
  const rewardCents = Math.max(0, Math.round(Number(reward) * 100)) || 0;
  const totalCents = rewardCents * winners;

  const submit = async () => {
    setError(null);
    if (title.trim().length < 3) return setError("Give the bounty a title");
    if (description.trim().length < 10) return setError("Describe what someone has to do (10+ characters)");
    if (rewardCents < 100) return setError("Reward must be at least $1");
    const c = useLocation ? center ?? position : null;
    if (useLocation && !c) return setError("Tap the map to set where this happens, or turn location off");
    setBusy(true);
    try {
      const r = await api<{ bounty: { id: string } }>("/api/bounties", {
        method: "POST",
        json: {
          title: title.trim(),
          description: description.trim(),
          rewardCents,
          maxWinners: winners,
          ...(c ? { lat: c.lat, lng: c.lng, radiusM, areaName: areaName.trim() || undefined } : {}),
          ...(deadline ? { deadline: new Date(deadline).toISOString() } : {}),
        },
      });
      router.push(`/bounties/${r.bounty.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't post the bounty");
      setBusy(false);
    }
  };

  return (
    <main className="min-h-dvh pb-28 lg:grid lg:min-h-0 lg:grid-cols-[480px_minmax(0,1fr)] lg:pb-0">
      <div className={`relative h-[220px] w-full overflow-hidden rounded-b-[28px] lg:order-2 lg:h-dvh lg:rounded-none ${useLocation ? "" : "opacity-40"}`}>
        <DropMap center={mapCenter} zoom={14} me={position} circle={useLocation ? { center: mapCenter, radiusM } : null} onTap={(p) => useLocation && setCenter(p)} followKey={`${mapCenter.lat},${mapCenter.lng}`} attribution="bottom-right" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center p-4 pt-[calc(env(safe-area-inset-top)+12px)] lg:hidden">
          <Link href="/bounties" className="icon-btn pointer-events-auto">
            <X size={18} />
          </Link>
          <div className="flex-1 text-center text-[15px] font-semibold">Post a bounty</div>
          <div className="w-10" />
        </div>
        {useLocation && (
          <div className="pointer-events-none absolute left-1/2 top-[calc(env(safe-area-inset-top)+60px)] flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-fg/85 px-3 py-1.5 text-xs font-semibold text-white lg:left-auto lg:right-4 lg:top-4 lg:translate-x-0">
            <MapPin size={12} /> {center ? "Location set" : "Tap the map to set the location"}
          </div>
        )}
      </div>

      <div className="px-5 lg:order-1 lg:h-dvh lg:overflow-y-auto lg:border-r lg:border-line lg:bg-elev lg:px-8 lg:py-8">
        <div className="hidden items-center lg:flex">
          <Link href="/bounties" className="icon-btn">
            <X size={18} />
          </Link>
          <h1 className="ml-3 text-xl font-bold">Post a bounty</h1>
        </div>

        <div className="mt-6 space-y-3">
          <input className="input" placeholder="Title (e.g. Do a backflip off the pier)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          <textarea className="input min-h-[110px] resize-y" placeholder="What exactly has to happen on camera? Be specific so mods can judge it." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />

          <div className="grid grid-cols-2 gap-3">
            <label className="row-list block px-4 py-3">
              <span className="label">Reward per winner</span>
              <div className="flex items-center gap-1 text-2xl font-bold">
                <span className="text-faint">$</span>
                <input className="w-full bg-transparent outline-none" inputMode="decimal" value={reward} onChange={(e) => setReward(e.target.value)} />
              </div>
            </label>
            <label className="row-list block px-4 py-3">
              <span className="label">Winners</span>
              <select className="mt-1 w-full bg-transparent text-2xl font-bold outline-none" value={winners} onChange={(e) => setWinners(Number(e.target.value))}>
                {[1, 2, 3, 5, 10, 25].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="row-list">
            <label className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted">Has to happen at a place</span>
              <input type="checkbox" checked={useLocation} onChange={(e) => setUseLocation(e.target.checked)} className="h-5 w-5 accent-accent" />
            </label>
            {useLocation && (
              <>
                <div className="px-4 py-3">
                  <input className="input" placeholder="Place name (e.g. Santa Monica Pier)" value={areaName} onChange={(e) => setAreaName(e.target.value)} maxLength={80} />
                </div>
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">Area radius</span>
                    <span className="font-semibold">{radiusM} m</span>
                  </div>
                  <input type="range" min={20} max={5000} step={20} value={radiusM} onChange={(e) => setRadiusM(Number(e.target.value))} className="mt-2 w-full accent-accent" />
                </div>
              </>
            )}
            <div className="flex items-center justify-between px-4 py-3 text-sm">
              <span className="text-muted">Deadline (optional)</span>
              <input type="datetime-local" className="input !w-auto !py-1" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted">
          {formatUsd(totalCents, { compact: true })} is held until a mod approves a video submission, then paid to the winner.
        </p>
        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
        <button className="btn btn-primary mt-4 w-full" disabled={busy || rewardCents < 100} onClick={submit}>
          <Lock size={16} /> Post bounty · {formatUsd(totalCents, { compact: true })}
        </button>
      </div>
    </main>
  );
}
