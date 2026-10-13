"use client";

import { useEffect, useRef } from "react";
import { Map as MLMap, Marker, setWorkerUrl, type GeoJSONSource, type MapMouseEvent } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { LatLng } from "@/lib/geo";

export const MAP_STYLE = "https://tiles.openfreemap.org/styles/positron";

// The worker file is copied to /public by scripts/copy-maplibre-worker.mjs
// (runs on postinstall) because bundlers can't serve MapLibre's sibling worker.
if (typeof window !== "undefined") setWorkerUrl("/maplibre-gl-worker.mjs");

export type MapDrop = { id: string; lat: number; lng: number; amountCents: number; exact?: boolean };

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
  /** Big drops (top tier) get a halo once their exact spot is revealed. */
  bigAmountCents?: number;
  interactive?: boolean;
  className?: string;
  /** Re-centre the map on `center` whenever this value changes. */
  followKey?: string | number;
};

function circlePolygon(center: LatLng, radiusM: number, steps = 64) {
  const coords: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    coords.push([center.lng + dLng * Math.cos(t), center.lat + dLat * Math.sin(t)]);
  }
  return { type: "Feature" as const, geometry: { type: "Polygon" as const, coordinates: [coords] }, properties: {} };
}

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
      attributionControl: { compact: true },
    });
    m.on("load", () => {
      loaded.current = true;
      m.addSource("circle", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      m.addLayer({
        id: "circle-fill",
        type: "fill",
        source: "circle",
        paint: { "fill-color": "#8b3dff", "fill-opacity": 0.12 },
      });
      m.addLayer({
        id: "circle-line",
        type: "line",
        source: "circle",
        paint: { "line-color": "#8b3dff", "line-opacity": 0.6, "line-width": 1.5 },
      });
    });
    m.on("click", (e: MapMouseEvent) => onTapRef.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }));
    map.current = m;
    const markerStore = markers.current;
    return () => {
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

  // Sync drop markers.
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
        node.innerHTML = `<div class="halo" style="display:none"></div><div class="coin">$</div><div class="tag"></div>`;
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
      src.setData({
        type: "FeatureCollection",
        features: circle ? [circlePolygon(circle.center, circle.radiusM)] : [],
      });
    };
    if (loaded.current) apply();
    else m.once("load", apply);
  }, [circle?.center.lat, circle?.center.lng, circle?.radiusM]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={el} className={`h-full w-full ${className}`} />;
}
