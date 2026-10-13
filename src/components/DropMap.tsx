"use client";

import { useEffect, useRef } from "react";
import { AttributionControl, Map as MLMap, Marker, setWorkerUrl, type GeoJSONSource, type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng } from "@/lib/geo";

export const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

// The worker file is copied to /public by scripts/copy-maplibre-worker.mjs
// (runs on postinstall) because bundlers can't serve MapLibre's sibling worker.
if (typeof window !== "undefined") setWorkerUrl("/maplibre-gl-worker.mjs");

export type MapDrop = {
  id: string;
  lat: number;
  lng: number;
  amountCents: number;
  /** true when lat/lng is the real spot. */
  exact?: boolean;
  /** Search circle radius (metres) drawn around approximate drops. */
  searchRadiusM?: number;
};

type Props = {
  center: LatLng;
  zoom?: number;
  drops?: MapDrop[];
  me?: LatLng | null;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Called with the tapped location (used by dev "simulate location" and area picking). */
  onTap?: (p: LatLng) => void;
  /** Draws a translucent circle (metres) around `circleCenter`. */
  circle?: { center: LatLng; radiusM: number } | null;
  /** Big drops (top tier) get a bigger coin. */
  bigAmountCents?: number;
  interactive?: boolean;
  className?: string;
  /** Re-centre the map on `center` whenever this value changes. */
  followKey?: string | number;
  attribution?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
};

const LOGO_SVG = `<svg viewBox="0 0 64 64" aria-hidden><defs><linearGradient id="g" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#14F195"/><stop offset="1" stop-color="#9945FF"/></linearGradient></defs><g fill="url(#g)"><path d="M22 18h26l-6 6H16z"/><path d="M16 29h26l6 6H22z"/><path d="M22 40h26l-6 6H16z"/></g></svg>`;

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

const EMPTY = { type: "FeatureCollection" as const, features: [] as ReturnType<typeof circlePolygon>[] };

export function DropMap({
  center,
  zoom = 15,
  drops = [],
  me,
  selectedId,
  onSelect,
  onTap,
  circle,
  bigAmountCents,
  interactive = true,
  className = "",
  followKey,
  attribution = "bottom-right",
}: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<MLMap | null>(null);
  const markers = useRef<Map<string, Marker>>(new Map());
  const meMarker = useRef<Marker | null>(null);
  const loaded = useRef(false);
  const onTapRef = useRef(onTap);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onTapRef.current = onTap;
    onSelectRef.current = onSelect;
  }, [onTap, onSelect]);

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
    m.on("load", () => {
      loaded.current = true;
      m.addSource("circle", { type: "geojson", data: EMPTY });
      m.addSource("search", { type: "geojson", data: EMPTY });
      m.addLayer({ id: "search-fill", type: "fill", source: "search", paint: { "fill-color": "#8b3dff", "fill-opacity": 0.1 } });
      m.addLayer({
        id: "search-line",
        type: "line",
        source: "search",
        paint: { "line-color": "#8b3dff", "line-opacity": 0.55, "line-width": 1.5, "line-dasharray": [2, 2] },
      });
      m.addLayer({ id: "circle-fill", type: "fill", source: "circle", paint: { "fill-color": "#8b3dff", "fill-opacity": 0.12 } });
      m.addLayer({ id: "circle-line", type: "line", source: "circle", paint: { "line-color": "#8b3dff", "line-opacity": 0.6, "line-width": 1.5 } });
    });
    m.on("click", (e: MapMouseEvent) => onTapRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    map.current = m;

    // Keep the canvas sized to its container (sidebars, panels, rotation).
    const ro = new ResizeObserver(() => m.resize());
    ro.observe(el.current);

    const markerStore = markers.current;
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      loaded.current = false;
      markerStore.clear();
      meMarker.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow centre when asked.
  useEffect(() => {
    if (followKey === undefined || !map.current) return;
    map.current.easeTo({ center: [center.lng, center.lat], duration: 600 });
  }, [followKey, center.lat, center.lng]);

  // Sync drop markers + search circles.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    for (const d of drops) {
      seen.add(d.id);
      let mk = markers.current.get(d.id);
      const big = bigAmountCents !== undefined && d.amountCents >= bigAmountCents;
      if (!mk) {
        const node = document.createElement("div");
        node.className = "md-marker";
        // Stagger animations so coins don't spin in lockstep.
        const delay = -((parseInt(d.id.slice(-4), 36) || 0) % 2600);
        node.innerHTML = `<div class="halo" style="display:none"></div><div class="spin" style="animation-delay:${delay}ms,${delay}ms"><div class="coin">${LOGO_SVG}</div></div><div class="tag"></div>`;
        node.addEventListener("click", (ev) => {
          ev.stopPropagation();
          onSelectRef.current?.(d.id);
        });
        mk = new Marker({ element: node, anchor: "center" }).setLngLat([d.lng, d.lat]).addTo(m);
        markers.current.set(d.id, mk);
      } else {
        mk.setLngLat([d.lng, d.lat]);
      }
      const node = mk.getElement();
      node.classList.toggle("big", big);
      node.classList.toggle("selected", d.id === selectedId);
      const tag = node.querySelector<HTMLElement>(".tag")!;
      const showTag = big || d.amountCents >= 2000 || d.id === selectedId;
      tag.style.display = showTag ? "block" : "none";
      tag.textContent = `$${Math.round(d.amountCents / 100)}`;
      node.querySelector<HTMLElement>(".halo")!.style.display = d.exact ? "block" : "none";
    }
    for (const [id, mk] of markers.current) {
      if (!seen.has(id)) {
        mk.remove();
        markers.current.delete(id);
      }
    }
    const apply = () => {
      const src = m.getSource("search") as GeoJSONSource | undefined;
      if (!src) return;
      src.setData({
        type: "FeatureCollection",
        features: drops.filter((d) => !d.exact && d.searchRadiusM).map((d) => circlePolygon(d, d.searchRadiusM!)),
      });
    };
    if (loaded.current) apply();
    else m.once("load", apply);
  }, [drops, selectedId, bigAmountCents]);

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

  return <div ref={el} className={`h-full w-full ${className}`} />;
}
