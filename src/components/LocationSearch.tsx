"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X, MapPin } from "lucide-react";
import { api } from "@/lib/client";
import type { LatLng } from "@/lib/geo";

type Result = { name: string; detail: string; lat: number; lng: number };

/**
 * Address / place search that sits on top of a map picker. Picking a result
 * hands back the coordinates and a display name.
 */
export function LocationSearch({
  near,
  onPick,
  className = "",
  placeholder = "Search an address or place",
}: {
  near?: LatLng | null;
  onPick: (p: LatLng & { name: string }) => void;
  className?: string;
  placeholder?: string;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const term = q.trim();
  const visible = term.length >= 2 ? results : [];

  // Debounced lookup.
  useEffect(() => {
    if (term.length < 2) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      const bias = near ? `&lat=${near.lat}&lng=${near.lng}` : "";
      api<{ results: Result[] }>(`/api/geocode?q=${encodeURIComponent(term)}${bias}`)
        .then((r) => {
          if (cancelled) return;
          setResults(r.results);
          setOpen(true);
        })
        .catch(() => {})
        .finally(() => !cancelled && setLoading(false));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, near?.lat, near?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={box} className={`relative ${className}`}>
      <div className="card flex items-center gap-2 px-3 py-2">
        <Search size={16} className="shrink-0 text-faint" />
        <input
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => visible.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && visible[0]) {
              e.preventDefault();
              onPick({ lat: visible[0].lat, lng: visible[0].lng, name: visible[0].name });
              setQ(visible[0].name);
              setOpen(false);
            }
            if (e.key === "Escape") setOpen(false);
          }}
        />
        {loading ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-line border-t-accent" />
        ) : (
          q && (
            <button className="text-faint" onClick={() => { setQ(""); setResults([]); }} aria-label="Clear">
              <X size={14} />
            </button>
          )
        )}
      </div>
      {open && visible.length > 0 && (
        <ul className="card pop-in absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-y-auto py-1">
          {visible.map((r, i) => (
            <li key={i}>
              <button
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-soft"
                onClick={() => {
                  onPick({ lat: r.lat, lng: r.lng, name: r.name });
                  setQ(r.name);
                  setOpen(false);
                }}
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-accent" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{r.name}</span>
                  {r.detail && <span className="block truncate text-xs text-muted">{r.detail}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
