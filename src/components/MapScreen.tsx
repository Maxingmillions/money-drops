"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Plus, Crosshair, Sparkles, Eye, ShieldCheck, Compass, MapPin, Search } from "lucide-react";
import { DropMap, type MapHunt, type Viewport } from "./DropMap";
import { LocationSearch } from "./LocationSearch";
import { Coin } from "./Coin";
import { api } from "@/lib/client";
import { formatDistance, formatSol, walkMinutes, type LatLng } from "@/lib/geo";
import { DEV_LOCATION, useGeolocation } from "@/hooks/useGeolocation";
import type { PublicDrop } from "@/lib/drops";

// Where the map opens before we have a GPS fix (matches the seed data).
const FALLBACK: LatLng = { lat: 35.6717, lng: 139.6949 };

export function MapScreen({ guest = false }: { guest?: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const hunt = (id: string) => router.push(guest ? `/sign-in?next=${encodeURIComponent(`/hunt/${id}`)}` : `/hunt/${id}`);
  const { position, error, isSimulated, setSimulated } = useGeolocation();
  const [drops, setDrops] = useState<PublicDrop[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(params.get("drop"));
  const [simMode, setSimMode] = useState(false);
  const [followKey, setFollowKey] = useState(0);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; zoom?: number; key: number } | null>(null);
  const jumpTo = (p: { lat: number; lng: number }) => setFlyTo({ ...p, zoom: 14, key: Date.now() });

  const [viewport, setViewport] = useState<Viewport | null>(null);
  const [hunts, setHunts] = useState<MapHunt[]>([]);

  const center = position ?? FALLBACK;
  const ulat = position?.lat;
  const ulng = position?.lng;

  // Drops for whatever is in view (debounced on pan/zoom, refreshed every 8 s).
  const vLat = viewport?.center.lat;
  const vLng = viewport?.center.lng;
  const vRadius = viewport ? Math.min(60_000, Math.max(300, Math.round(viewport.radiusM))) : null;
  const zoomedOut = (viewport?.zoom ?? 15) < 9;
  useEffect(() => {
    if (vLat == null || vLng == null || vRadius == null) return;
    if (zoomedOut) {
      const clear = setTimeout(() => setDrops([]), 0);
      return () => clearTimeout(clear);
    }
    let cancelled = false;
    const who = ulat != null && ulng != null ? `&ulat=${ulat}&ulng=${ulng}` : "&user=none";
    const refresh = () =>
      api<{ drops: PublicDrop[] }>(`/api/drops/nearby?lat=${vLat}&lng=${vLng}&radius=${vRadius}${who}`)
        .then((r) => !cancelled && setDrops(r.drops))
        .catch(() => {});
    const first = setTimeout(refresh, 250);
    const t = setInterval(refresh, 8000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(t);
    };
  }, [vLat, vLng, vRadius, zoomedOut, ulat, ulng]);

  // One bubble per live hunt for the zoomed-out view.
  useEffect(() => {
    let cancelled = false;
    const pull = () =>
      api<{ campaigns: MapHunt[] }>("/api/drops/overview")
        .then((r) => !cancelled && setHunts(r.campaigns))
        .catch(() => {});
    pull();
    const t = setInterval(pull, 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  const selected = useMemo(() => drops.find((d) => d.id === selectedId) ?? null, [drops, selectedId]);
  const bigAmount = useMemo(() => (drops.length ? Math.max(...drops.map((d) => d.amountLamports)) : undefined), [drops]);
  const total = drops.reduce((s, d) => s + d.amountLamports, 0);
  const headline = selected?.campaign ?? drops[0]?.campaign ?? null;
  const huntsTotal = hunts.reduce((s, h) => s + h.remainingLamports, 0);
  const summary = zoomedOut
    ? `${formatSol(huntsTotal, { compact: true })} hidden across ${hunts.length} hunts`
    : drops.length
      ? `${formatSol(total, { compact: true })} in ${drops.length} drops in view`
      : "No drops in view · zoom out to see hunts";

  const mapDrops = drops.map((d) => ({
    id: d.id,
    lat: d.lat,
    lng: d.lng,
    amountLamports: d.amountLamports,
    exact: d.exact,
    searchRadiusM: d.campaign.searchRadiusM,
  }));

  return (
    <main className={`relative overflow-hidden lg:grid lg:grid-cols-[380px_minmax(0,1fr)] ${guest ? "h-[calc(100dvh-57px)]" : "h-dvh"}`}>
      {/* Desktop side panel */}
      <aside className={`hidden flex-col border-r border-line bg-elev lg:flex ${guest ? "h-[calc(100dvh-57px)]" : "h-dvh"}`}>
        <div className="border-b border-line p-5">
          <h1 className="text-xl font-bold">{guest ? "Live drops" : "Hunt"}</h1>
          <p className="text-sm text-muted">{summary}</p>
          {error && !position && <p className="mt-2 text-xs text-danger">{error}</p>}
          <div className="mt-3">
            <LocationSearch near={position} placeholder="Search a city, address or place" onPick={jumpTo} />
          </div>
        </div>
        {selected ? (
          <div className="p-5">
            <button className="mb-3 text-sm text-muted hover:text-fg" onClick={() => setSelectedId(null)}>
              ← All drops
            </button>
            <DropDetail drop={selected} guest={guest} onHunt={() => hunt(selected.id)} />
          </div>
        ) : (
          <ul className="flex-1 overflow-y-auto">
            {drops.map((d) => (
              <li key={d.id}>
                <button
                  className="flex w-full items-center gap-3 border-b border-line px-5 py-3 text-left hover:bg-soft"
                  onClick={() => setSelectedId(d.id)}
                >
                  <Coin size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{formatSol(d.amountLamports, { compact: true })} drop</div>
                    <div className="truncate text-xs text-muted">
                      {d.campaign.areaName ?? d.campaign.title} · {formatDistance(d.distanceM)}
                    </div>
                  </div>
                  {d.exact && <span className="pill bg-success-soft text-success">Revealed</span>}
                </button>
              </li>
            ))}
            {zoomedOut &&
              hunts.map((h) => (
                <li key={h.id} className="border-b border-line px-5 py-3 text-sm">
                  <div className="font-semibold">{h.title}</div>
                  <div className="text-xs text-muted">
                    {formatSol(h.remainingLamports, { compact: true })} · {h.remaining} drops left
                  </div>
                </li>
              ))}
            {drops.length === 0 && !zoomedOut && (
              <li className="px-5 py-8 text-center text-sm text-muted">
                Nothing in view.{" "}
                <Link href="/hide" className="text-accent">
                  Hide some money
                </Link>
                , zoom out to find hunts, or teleport with the pin button.
              </li>
            )}
          </ul>
        )}
      </aside>

      {/* Map */}
      <div className="relative h-full">
        <DropMap
          className="map-full"
          center={center}
          zoom={15}
          drops={mapDrops}
          hunts={hunts}
          me={position}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onViewport={setViewport}
          bigAmountCents={bigAmount}
          followKey={followKey}
          flyTo={flyTo}
          onTap={(p) => {
            if (simMode) setSimulated(p);
            else setSelectedId(null);
          }}
        />

        {/* Mobile top bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center gap-2 p-4 pt-[calc(env(safe-area-inset-top)+12px)] lg:hidden">
          {!guest && (
            <Link href="/home" className="icon-btn pointer-events-auto">
              <ChevronLeft size={20} />
            </Link>
          )}
          <div className="card pointer-events-auto flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-sm font-bold text-white">
              {(headline?.creator ?? "D").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{headline?.title ?? "Nearby drops"}</div>
              <div className="truncate text-xs text-muted">{summary}</div>
            </div>
          </div>
          {!guest && (
            <Link href="/hide" className="icon-btn pointer-events-auto">
              <Plus size={20} />
            </Link>
          )}
        </div>

        {/* Mobile search */}
        <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+64px)] z-10 lg:hidden">
          <LocationSearch near={position} placeholder="Search a city, address or place" onPick={jumpTo} />
        </div>

        {/* Controls */}
        <div className="absolute right-4 top-[calc(env(safe-area-inset-top)+116px)] z-10 flex flex-col gap-2 lg:top-4">
          <button className="icon-btn" aria-label="Centre on me" title="Centre on me" onClick={() => setFollowKey((k) => k + 1)}>
            <Crosshair size={18} />
          </button>
          {DEV_LOCATION && (
            <button
              className={`icon-btn ${simMode ? "!bg-accent !text-white" : ""}`}
              title="Tap the map to move yourself (dev)"
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
          <div className="absolute left-1/2 top-[calc(env(safe-area-inset-top)+116px)] z-10 -translate-x-1/2 rounded-full bg-fg px-3 py-1.5 text-xs font-semibold text-white lg:top-4">
            Tap the map to move yourself
          </div>
        )}
        {error && !position && (
          <div className="absolute left-4 right-4 top-[calc(env(safe-area-inset-top)+116px)] z-10 rounded-2xl bg-white/90 p-3 text-center text-xs text-muted shadow lg:hidden">
            {error}
          </div>
        )}

        {/* Mobile drop sheet */}
        {selected && (
          <div className="absolute inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] lg:hidden">
            <div className="card p-5">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
              <DropDetail drop={selected} guest={guest} onHunt={() => hunt(selected.id)} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function DropDetail({ drop, onHunt, guest = false }: { drop: PublicDrop; onHunt: () => void; guest?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <Coin size={44} />
        <div>
          <div className="text-[22px] font-bold leading-tight">{formatSol(drop.amountLamports, { compact: true })} drop</div>
          <div className="text-sm text-muted">
            {drop.campaign.areaName ? `${drop.campaign.areaName} · ` : ""}
            {Number.isFinite(drop.distanceM)
              ? `${formatDistance(drop.distanceM)} · ${walkMinutes(drop.distanceM)} min walk`
              : "distance unknown"}
          </div>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm text-muted">
        <li className="flex items-center gap-2">
          <Sparkles size={15} className="text-faint" />
          <span>
            <b className="text-fg">
              {drop.campaign.bigRemaining} of {drop.campaign.bigTotal}
            </b>{" "}
            big drops still hidden
          </span>
        </li>
        <li className="flex items-center gap-2">
          <Search size={15} className="text-faint" />
          <span>
            Hidden somewhere in a <b className="text-fg">{drop.campaign.searchRadiusM} m</b> circle
          </span>
        </li>
        <li className="flex items-center gap-2">
          <Eye size={15} className="text-faint" />
          <span>
            Exact spot shows up <b className="text-fg">{drop.campaign.revealRadiusM} m</b> away
          </span>
        </li>
        <li className="flex items-center gap-2">
          <ShieldCheck size={15} className="text-faint" />
          <span>Only ever in public places</span>
        </li>
      </ul>
      <button className="btn btn-primary mt-5 w-full" onClick={onHunt}>
        <Compass size={18} /> {guest ? "Sign in to hunt this" : "Start the hunt"}
      </button>
    </div>
  );
}
