"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { LatLng } from "@/lib/geo";

export type Fix = LatLng & { accuracyM: number; heading: number | null; at: number };

const SIM_KEY = "md:simulated-location";
export const DEV_LOCATION = process.env.NEXT_PUBLIC_DEV_LOCATION === "true";

// Simulated location lives in localStorage; read it through an external
// store so every hook instance (and tab) sees the same value.
let simCache: { raw: string | null; fix: Fix | null } = { raw: null, fix: null };
function readSim(): Fix | null {
  if (!DEV_LOCATION || typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(SIM_KEY);
  } catch {
    raw = null;
  }
  if (raw !== simCache.raw) {
    let fix: Fix | null = null;
    try {
      fix = raw ? (JSON.parse(raw) as Fix) : null;
    } catch {
      fix = null;
    }
    simCache = { raw, fix };
  }
  return simCache.fix;
}
const SIM_EVENT = "md:simulated-location-change";
function subscribeSim(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(SIM_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(SIM_EVENT, cb);
  };
}
const geolocationSupported = () => typeof navigator !== "undefined" && "geolocation" in navigator;

/**
 * Live device position. In dev (NEXT_PUBLIC_DEV_LOCATION=true) a simulated
 * position stored in localStorage overrides the real one so the hunt flow can
 * be tested from a desk.
 */
const GRANTED_EVENT = "md:location-granted";
function subscribeGranted(cb: () => void) {
  window.addEventListener(GRANTED_EVENT, cb);
  return () => window.removeEventListener(GRANTED_EVENT, cb);
}
let grantedCount = 0;
if (typeof window !== "undefined") window.addEventListener(GRANTED_EVENT, () => grantedCount++);

export function useGeolocation(opts: { watch?: boolean } = { watch: true }) {
  const [fix, setFix] = useState<Fix | null>(null);
  // Bumps when the permission prompt succeeds so a failed watch is retried.
  const granted = useSyncExternalStore(subscribeGranted, () => grantedCount, () => 0);
  const [geoError, setError] = useState<string | null>(null);
  const simulated = useSyncExternalStore(subscribeSim, readSim, () => null);
  const supported = useSyncExternalStore(() => () => {}, geolocationSupported, () => true);
  const error = supported ? geoError : "Location is not available on this device";

  useEffect(() => {
    if (!geolocationSupported()) return;
    const ok = (p: GeolocationPosition) => {
      setError(null);
      setFix({
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        accuracyM: p.coords.accuracy,
        heading: Number.isFinite(p.coords.heading as number) ? p.coords.heading : null,
        at: p.timestamp,
      });
    };
    const fail = (e: GeolocationPositionError) => {
      setError(
        e.code === e.PERMISSION_DENIED
          ? "Location permission denied. Enable it in your browser settings to hunt."
          : "Couldn't get your location yet",
      );
    };
    const options: PositionOptions = { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 };
    if (opts.watch === false) {
      navigator.geolocation.getCurrentPosition(ok, fail, options);
      return;
    }
    const id = navigator.geolocation.watchPosition(ok, fail, options);
    return () => navigator.geolocation.clearWatch(id);
  }, [opts.watch, granted]);

  const setSimulated = useCallback((p: LatLng | null) => {
    if (!DEV_LOCATION) return;
    if (!p) window.localStorage.removeItem(SIM_KEY);
    else {
      const f: Fix = { ...p, accuracyM: 5, heading: null, at: Date.now() };
      window.localStorage.setItem(SIM_KEY, JSON.stringify(f));
    }
    window.dispatchEvent(new Event(SIM_EVENT));
  }, []);

  return {
    position: simulated ?? fix,
    real: fix,
    simulated,
    isSimulated: Boolean(simulated),
    error: simulated ? null : error,
    setSimulated,
  };
}
