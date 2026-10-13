"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

type WebkitOrientationEvent = DeviceOrientationEvent & { webkitCompassHeading?: number };

const noopSubscribe = () => () => {};
const requiresPermission = () => {
  if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return false;
  const DOE = DeviceOrientationEvent as unknown as { requestPermission?: unknown };
  return typeof DOE.requestPermission === "function";
};

/**
 * Device compass heading in degrees (0 = north), or null when unavailable.
 * iOS needs a user gesture to grant permission: call `request()` from a tap.
 */
export function useCompassHeading() {
  const [heading, setHeading] = useState<number | null>(null);
  const [granted, setGranted] = useState(false);
  // iOS Safari gates orientation events behind a permission prompt.
  const gated = useSyncExternalStore(noopSubscribe, requiresPermission, () => false);
  const needsPermission = gated && !granted;

  useEffect(() => {
    if (needsPermission) return;
    const onEvent = (e: WebkitOrientationEvent) => {
      if (typeof e.webkitCompassHeading === "number") {
        setHeading(e.webkitCompassHeading);
      } else if (e.absolute && e.alpha != null) {
        setHeading((360 - e.alpha) % 360);
      } else if (e.alpha != null) {
        setHeading((360 - e.alpha) % 360);
      }
    };
    window.addEventListener("deviceorientationabsolute", onEvent as EventListener, true);
    window.addEventListener("deviceorientation", onEvent as EventListener, true);
    return () => {
      window.removeEventListener("deviceorientationabsolute", onEvent as EventListener, true);
      window.removeEventListener("deviceorientation", onEvent as EventListener, true);
    };
  }, [needsPermission]);

  const request = async () => {
    const DOE = DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    if (typeof DOE.requestPermission === "function") {
      try {
        const r = await DOE.requestPermission();
        if (r === "granted") setGranted(true);
      } catch {
        /* ignored */
      }
    }
  };

  return { heading, needsPermission, request };
}
