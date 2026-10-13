"use client";

import { useEffect, useState } from "react";
import { MapPin, Compass, X, ExternalLink, Copy, Check } from "lucide-react";
import { inWalletBrowser, isIOS, openInSystemBrowser } from "@/lib/handoff";

/**
 * Big one-time prompt after sign-in: asks for location (and, on iOS, motion
 * for the compass) from a real tap, which is the only way wallet in-app
 * browsers and Safari will show their permission sheets.
 */
const SEEN_KEY = "md:perm-asked";
export const LOCATION_GRANTED_EVENT = "md:location-granted";

type Stage = "hidden" | "ask" | "busy" | "denied" | "wallet";

export function PermissionsGate() {
  const [stage, setStage] = useState<Stage>("hidden");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    let dismissed = false;
    try {
      dismissed = sessionStorage.getItem(SEEN_KEY) === "1";
    } catch {}
    if (dismissed) return;
    let cancelled = false;
    // Wallet in-app browsers (Phantom on iOS especially) never pass location
    // through, so the only fix is to continue in the system browser.
    if (inWalletBrowser()) {
      const t = setTimeout(() => setStage("wallet"), 0);
      return () => clearTimeout(t);
    }
    const show = () => !cancelled && setStage("ask");
    // Skip the prompt entirely when the browser already granted location.
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((p) => {
          if (p.state === "granted") return;
          show();
        })
        .catch(show);
    } else {
      show();
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const remember = () => {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {}
  };

  const allow = async () => {
    setStage("busy");
    // iOS: motion permission must be requested synchronously inside the tap.
    const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<"granted" | "denied"> };
    if (typeof DOE.requestPermission === "function") {
      try {
        await DOE.requestPermission();
      } catch {}
    }
    navigator.geolocation.getCurrentPosition(
      () => {
        remember();
        window.dispatchEvent(new Event(LOCATION_GRANTED_EVENT));
        setStage("hidden");
      },
      (e) => {
        if (e.code === e.PERMISSION_DENIED) setStage("denied");
        else {
          // Timeout or unavailable: permission is likely fine, just slow. Let the app carry on.
          remember();
          window.dispatchEvent(new Event(LOCATION_GRANTED_EVENT));
          setStage("hidden");
        }
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  };

  const dismiss = () => {
    remember();
    setStage("hidden");
  };

  const handoff = async () => {
    try {
      const url = await openInSystemBrowser();
      setLink(url);
    } catch {
      setLink(null);
    }
  };
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (stage === "hidden") return null;
  const ios = isIOS();
  const inWallet = inWalletBrowser();
  const browserName = ios ? "Safari" : "Chrome";

  if (stage === "wallet") {
    return (
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center">
        <div className="card pop-in w-full max-w-[420px] p-6 text-center">
          <button className="icon-btn absolute right-3 top-3 !h-8 !w-8" aria-label="Not now" onClick={dismiss}>
            <X size={14} />
          </button>
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent-soft text-accent">
            <MapPin size={36} />
          </div>
          <h2 className="mt-5 text-[22px] font-bold">Hunt in {browserName}, not in the wallet</h2>
          <p className="mt-2 text-sm text-muted">
            Your wallet&apos;s built-in browser doesn&apos;t share your location with websites, so the map and compass can&apos;t work here. Open Drops in {browserName} and you&apos;ll stay signed in. Come back to the wallet only when you need to pay for a hunt or bounty.
          </p>
          <button className="btn btn-primary mt-5 w-full" onClick={handoff}>
            <ExternalLink size={16} /> Open in {browserName}
          </button>
          {link && (
            <div className="mt-3 rounded-2xl bg-soft p-3 text-left text-xs text-muted">
              Didn&apos;t switch? Copy this link and paste it into {browserName} within 5 minutes.
              <button className="btn btn-secondary mt-2 w-full !py-2 text-xs" onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy link"}
              </button>
            </div>
          )}
          <button className="mt-3 text-sm font-semibold text-muted" onClick={dismiss}>
            Stay here
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center">
      <div className="card pop-in w-full max-w-[420px] p-6 text-center">
        <button className="icon-btn absolute right-3 top-3 !h-8 !w-8" aria-label="Not now" onClick={dismiss}>
          <X size={14} />
        </button>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent-soft text-accent">
          <MapPin size={36} />
        </div>
        {stage !== "denied" ? (
          <>
            <h2 className="mt-5 text-[22px] font-bold">Turn on location for the map</h2>
            <p className="mt-2 text-sm text-muted">
              Drops is played on a real map. Your location is used only on this phone to show drops near you, point the compass at them, and let you claim when you&apos;re standing on one. It isn&apos;t shared with other players.
            </p>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-faint">
              <Compass size={13} /> {ios ? "Also asks for motion access so the compass works." : "The compass uses your phone's sensors."}
            </p>
            <button className="btn btn-primary mt-5 w-full" onClick={allow} disabled={stage === "busy"}>
              <MapPin size={16} /> {stage === "busy" ? "Waiting for your phone…" : "Allow location"}
            </button>
            <button className="mt-3 text-sm font-semibold text-muted" onClick={dismiss}>
              Not now
            </button>
          </>
        ) : (
          <>
            <h2 className="mt-5 text-[22px] font-bold">Location is blocked</h2>
            <p className="mt-2 text-sm text-muted">The browser said no, so the map can&apos;t find you. Turn it on and come back:</p>
            <ol className="mt-3 space-y-1.5 text-left text-sm">
              {ios ? (
                <>
                  <li>1. Open iPhone <b>Settings</b></li>
                  <li>2. Scroll to <b>{inWallet ? "Phantom (or your wallet app)" : "Safari"}</b> → <b>Location</b></li>
                  <li>3. Choose <b>While Using the App</b></li>
                  {!inWallet && <li>4. Also check Settings → Privacy &amp; Security → Location Services → Safari Websites</li>}
                </>
              ) : (
                <>
                  <li>1. Open the browser&apos;s site settings (lock icon in the address bar)</li>
                  <li>2. Set <b>Location</b> to <b>Allow</b></li>
                  <li>3. Reload this page</li>
                </>
              )}
            </ol>
            <button className="btn btn-primary mt-5 w-full" onClick={allow}>
              Try again
            </button>
            <button className="mt-3 text-sm font-semibold text-muted" onClick={dismiss}>
              Not now
            </button>
          </>
        )}
      </div>
    </div>
  );
}
