"use client";

import { useEffect, useRef } from "react";
import {
  AttributionControl,
  Map as MLMap,
  Marker,
  setWorkerUrl,
  type GeoJSONSource,
  type MapMouseEvent,
  type MapSourceDataEvent,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { distanceM, type LatLng } from "@/lib/geo";

export const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

// The worker file is copied to /public by scripts/copy-maplibre-worker.mjs
// (runs on postinstall) because bundlers can't serve MapLibre's sibling worker.
if (typeof window !== "undefined") setWorkerUrl("/maplibre-gl-worker.mjs");

export type MapDrop = {
  id: string;
  lat: number;
  lng: number;
  amountLamports: number;
  /** true when lat/lng is the real spot. */
  exact?: boolean;
  /** Search circle radius (metres) drawn around approximate drops. */
  searchRadiusM?: number;
};

/** One bubble per live hunt, shown when zoomed out to city / world level. */
export type MapHunt = { id: string; title: string; lat: number; lng: number; remaining: number; remainingLamports: number };

export type Viewport = { center: LatLng; radiusM: number; zoom: number };

type Props = {
  center: LatLng;
  zoom?: number;
  drops?: MapDrop[];
  hunts?: MapHunt[];
  me?: LatLng | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Called with the tapped location (used by dev "simulate location" and area picking). */
  onTap?: (p: LatLng) => void;
  /** Fired after the map settles on a new view. */
  onViewport?: (v: Viewport) => void;
  /** Draws a translucent circle (metres) around `circleCenter`. */
  circle?: { center: LatLng; radiusM: number } | null;
  /** Big drops (top tier) get a bigger coin. */
  bigAmountCents?: number;
  interactive?: boolean;
  className?: string;
  /** Re-centre the map on `center` whenever this value changes. */
  followKey?: string | number;
  /** Fly somewhere else (search result); `key` must change to trigger. */
  flyTo?: { lat: number; lng: number; zoom?: number; key: number } | null;
  attribution?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

/** Below this zoom we show one bubble per hunt instead of drops. */
const HUNT_ZOOM = 9;
/** Search circles and price tags only make sense when close. */
const DETAIL_ZOOM = 14;

const LOGO_SVG = `<svg viewBox="0 0 64 64" aria-hidden><defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#14F195"/><stop offset="1" stop-color="#9945FF"/></linearGradient></defs><g fill="url(#g)"><path d="M22 18h26l-6 6H16z"/><path d="M16 29h26l6 6H22z"/><path d="M22 40h26l-6 6H16z"/></g></svg>`;

import { formatSol } from "@/lib/geo";
const usd = (lamports: number) => formatSol(lamports, { compact: true });

function circlePolygon(center: LatLng, radiusM: number, steps = 48) {
  const coords: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    coords.push([center.lng + dLng * Math.cos(t), center.lat + dLat * Math.sin(t)]);
  }
  return { type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [coords] }, properties: {} };
}

const EMPTY = { type: "FeatureCollection" as const, features: [] as GeoJSON.Feature[] };

/** Coin size multiplier for a zoom level: tiny far out, full size up close. */
const coinScale = (zoom: number) => Math.min(1, Math.max(0.4, 0.4 + (zoom - 11) * 0.15));

export function DropMap({
  center,
  zoom = 15,
  drops = [],
  hunts = [],
  me,
  selectedId,
  onSelect,
  onTap,
  onViewport,
  circle,
  bigAmountCents,
  interactive = true,
  className = "",
  followKey,
  flyTo,
  attribution = "bottom-right",
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const loaded = useRef(false);
  const markers = useRef<Map<string, Marker>>(new Map()); // drop + cluster markers, keyed
  const huntMarkers = useRef<Map<string, Marker>>(new Map());
  const meMarker = useRef<Marker | null>(null);
  const dropsRef = useRef(drops);
  const huntsRef = useRef(hunts);
  const selectedRef = useRef(selectedId);
  const bigRef = useRef(bigAmountCents);
  const cbs = useRef({ onTap, onSelect, onViewport });
  useEffect(() => {
    cbs.current = { onTap, onSelect, onViewport };
  }, [onTap, onSelect, onViewport]);
  useEffect(() => {
    dropsRef.current = drops;
    selectedRef.current = selectedId;
    bigRef.current = bigAmountCents;
  }, [drops, selectedId, bigAmountCents]);
  useEffect(() => {
    huntsRef.current = hunts;
  }, [hunts]);

  // Create map once.
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = new MLMap({
      container: el.current,
      style: MAP_STYLE,
      center: [center.lng, center.lat],
      zoom,
      interactive,
      attributionControl: false,
    });
    m.addControl(new AttributionControl({ compact: true }), attribution);

    const emitViewport = () => {
      const b = m.getBounds();
      const c = m.getCenter();
      const radiusM = distanceM({ lat: b.getNorth(), lng: b.getEast() }, { lat: b.getSouth(), lng: b.getWest() }) / 2;
      cbs.current.onViewport?.({ center: { lat: c.lat, lng: c.lng }, radiusM, zoom: m.getZoom() });
    };

    m.on("load", () => {
      loaded.current = true;
      m.addSource("circle", { type: "geojson", data: EMPTY });
      m.addSource("search", { type: "geojson", data: EMPTY });
      m.addSource("drops", {
        type: "geojson",
        data: EMPTY,
        cluster: true,
        clusterRadius: 56,
        clusterMaxZoom: 16,
        clusterProperties: { total: ["+", ["get", "amountLamports"]] },
      });
      m.addLayer({ id: "search-fill", type: "fill", source: "search", paint: { "fill-color": "#8b3dff", "fill-opacity": 0.1 } });
      m.addLayer({ id: "search-line", type: "line", source: "search", paint: { "line-color": "#8b3dff", "line-opacity": 0.55, "line-width": 1.5, "line-dasharray": [2, 2] } });
      m.addLayer({ id: "circle-fill", type: "fill", source: "circle", paint: { "fill-color": "#8b3dff", "fill-opacity": 0.12 } });
      m.addLayer({ id: "circle-line", type: "line", source: "circle", paint: { "line-color": "#8b3dff", "line-opacity": 0.6, "line-width": 1.5 } });
      // An invisible layer so the clustered source gets loaded and queryable.
      m.addLayer({ id: "drops-anchor", type: "circle", source: "drops", paint: { "circle-radius": 0, "circle-opacity": 0 } });
      syncAll();
      emitViewport();
    });
    m.on("click", (e: MapMouseEvent) => cbs.current.onTap?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    m.on("moveend", () => {
      syncAll();
      emitViewport();
    });
    m.on("zoom", syncAll);
    m.on("sourcedata", (e: MapSourceDataEvent) => {
      if (e.sourceId === "drops" && e.isSourceLoaded) syncAll();
    });
    map.current = m;

    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el.current);

    const markerStore = markers.current;
    const huntStore = huntMarkers.current;
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      loaded.current = false;
      markerStore.clear();
      huntStore.clear();
      meMarker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Rebuild DOM markers from what the clustered source currently shows. */
  function syncAll() {
    const m = map.current;
    if (!m || !loaded.current) return;
    const z = m.getZoom();
    const worldView = z < HUNT_ZOOM;
    el.current?.style.setProperty("--mk", String(coinScale(z)));

    // Hunt bubbles (world / city view).
    const seenHunts = new Set<string>();
    if (worldView) {
      for (const h of huntsRef.current) {
        seenHunts.add(h.id);
        let mk = huntMarkers.current.get(h.id);
        if (!mk) {
          const node = document.createElement("div");
          node.className = "md-cluster md-hunt pop-in";
          node.innerHTML = `<div class="coin">${LOGO_SVG}</div><span></span>`;
          node.addEventListener("click", (ev) => {
            ev.stopPropagation();
            m.easeTo({ center: [h.lng, h.lat], zoom: 14, duration: 900 });
          });
          mk = new Marker({ element: node, anchor: "center" }).setLngLat([h.lng, h.lat]).addTo(m);
          huntMarkers.current.set(h.id, mk);
        }
        mk.getElement().querySelector("span")!.textContent = `${usd(h.remainingLamports)} · ${h.remaining} drops`;
      }
    }
    for (const [id, mk] of huntMarkers.current) {
      if (!seenHunts.has(id)) {
        mk.remove();
        huntMarkers.current.delete(id);
      }
    }

    // Drop markers + clusters.
    const seen = new Set<string>();
    if (!worldView) {
      const feats = m.querySourceFeatures("drops");
      const byId = new Map<string, GeoJSON.Feature>();
      for (const f of feats) {
        const p = f.properties as Record<string, unknown>;
        const key = p.cluster ? `c:${p.cluster_id}` : `d:${p.id}`;
        if (!byId.has(key)) byId.set(key, f);
      }
      const detail = z >= DETAIL_ZOOM;
      for (const [key, f] of byId) {
        seen.add(key);
        const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
        const p = f.properties as Record<string, unknown>;
        let mk = markers.current.get(key);
        if (p.cluster) {
          if (!mk) {
            const node = document.createElement("div");
            node.className = "md-cluster pop-in";
            node.innerHTML = `<div class="coin">${LOGO_SVG}</div><span></span>`;
            const clusterId = p.cluster_id as number;
            node.addEventListener("click", async (ev) => {
              ev.stopPropagation();
              const src = m.getSource("drops") as GeoJSONSource;
              const target = await src.getClusterExpansionZoom(clusterId).catch(() => m.getZoom() + 2);
              m.easeTo({ center: [lng, lat], zoom: Math.min(target + 0.3, 17), duration: 700 });
            });
            mk = new Marker({ element: node, anchor: "center" }).setLngLat([lng, lat]).addTo(m);
            markers.current.set(key, mk);
          }
          mk.getElement().querySelector("span")!.textContent = `${usd(Number(p.total))} · ${p.point_count}`;
        } else {
          const id = String(p.id);
          const amountLamports = Number(p.amountLamports);
          const big = bigRef.current !== undefined && amountLamports >= bigRef.current;
          if (!mk) {
            const node = document.createElement("div");
            node.className = "md-marker";
            const delay = -((parseInt(id.slice(-4), 36) || 0) % 2600);
            node.innerHTML = `<div class="halo" style="display:none"></div><div class="spin" style="animation-delay:${delay}ms,${delay}ms"><div class="coin">${LOGO_SVG}</div></div><div class="tag"></div>`;
            node.addEventListener("click", (ev) => {
              ev.stopPropagation();
              cbs.current.onSelect?.(id);
            });
            mk = new Marker({ element: node, anchor: "center" }).setLngLat([lng, lat]).addTo(m);
            markers.current.set(key, mk);
          } else {
            mk.setLngLat([lng, lat]);
          }
          const node = mk.getElement();
          node.classList.toggle("big", big);
          node.classList.toggle("selected", id === selectedRef.current);
          const tag = node.querySelector<HTMLElement>(".tag")!;
          const showTag = detail && (big || amountLamports >= 2000 || id === selectedRef.current);
          tag.style.display = showTag ? "block" : "none";
          tag.textContent = usd(amountLamports);
          node.querySelector<HTMLElement>(".halo")!.style.display = detail && p.exact === true ? "block" : "none";
        }
      }
    }
    for (const [key, mk] of markers.current) {
      if (!seen.has(key)) {
        mk.remove();
        markers.current.delete(key);
      }
    }

    // Search circles only when close enough to matter.
    const search = m.getSource("search") as GeoJSONSource | undefined;
    if (search) {
      search.setData(
        z >= DETAIL_ZOOM
          ? { type: "FeatureCollection", features: dropsRef.current.filter((d) => !d.exact && d.searchRadiusM).map((d) => circlePolygon(d, d.searchRadiusM!)) }
          : EMPTY,
      );
    }
  }

  // Fly to a searched place.
  useEffect(() => {
    if (!flyTo || !map.current) return;
    map.current.easeTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom ?? 15, duration: 900 });
  }, [flyTo?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow centre when asked.
  useEffect(() => {
    if (followKey === undefined || !map.current) return;
    map.current.easeTo({ center: [center.lng, center.lat], duration: 600 });
  }, [followKey, center.lat, center.lng]);

  // Push drops into the clustered source.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      const src = m.getSource("drops") as GeoJSONSource | undefined;
      if (!src) return;
      src.setData({
        type: "FeatureCollection",
        features: drops.map((d) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [d.lng, d.lat] },
          properties: { id: d.id, amountLamports: d.amountLamports, exact: Boolean(d.exact), searchRadiusM: d.searchRadiusM ?? 0 },
        })),
      });
      syncAll();
    };
    if (loaded.current) apply();
    else m.once("load", apply);
  }, [drops]);

  // Re-sync when selection, hunts or big threshold change.
  useEffect(() => {
    syncAll();
  }, [selectedId, bigAmountCents, hunts]);

  // Me marker.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!me) {
      meMarker.current?.remove();
      meMarker.current = null;
      return;
    }
    if (!meMarker.current) {
      const node = document.createElement("div");
      node.className = "md-me";
      meMarker.current = new Marker({ element: node }).setLngLat([me.lng, me.lat]).addTo(m);
    } else {
      meMarker.current.setLngLat([me.lng, me.lat]);
    }
  }, [me?.lat, me?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Circle overlay.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const apply = () => {
      const src = m.getSource("circle") as GeoJSONSource | undefined;
      if (!src) return;
      src.setData({ type: "FeatureCollection", features: circle ? [circlePolygon(circle.center, circle.radiusM)] : [] });
    };
    if (loaded.current) apply();
    else m.once("load", apply);
  }, [circle?.center.lat, circle?.center.lng, circle?.radiusM]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={`h-full w-full ${className}`} style={{ ["--mk" as string]: 1 }} />;
}
