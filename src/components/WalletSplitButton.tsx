"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, Check, Wallet } from "lucide-react";

export type WalletOption = {
  id: string;
  name: string;
  /** Brand colour for the dot when there's no icon. */
  color?: string;
  icon?: string | null;
};

/**
 * One purple pill: the main part acts on the default wallet, the white arrow at
 * the far right opens a menu with the rest.
 */
export function WalletSplitButton({
  options,
  defaultId,
  busy,
  label,
  onPick,
}: {
  options: WalletOption[];
  defaultId?: string;
  busy?: boolean;
  /** Text for the main part, given the chosen wallet. */
  label?: (w: WalletOption) => string;
  onPick: (w: WalletOption) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(defaultId);
  const root = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.id === selectedId) ?? options.find((o) => o.id === defaultId) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  if (!selected) return null;
  const many = options.length > 1;

  return (
    <div ref={root} className="relative">
      <div className={`btn btn-primary w-full !p-0 ${open ? "rounded-b-none" : ""}`} style={{ overflow: "visible" }}>
        <button type="button" className="flex min-w-0 flex-1 items-center justify-center gap-2 py-[0.95rem] pl-5 pr-3 font-semibold" disabled={busy} onClick={() => onPick(selected)}>
          <Glyph w={selected} />
          <span className="truncate">{busy ? "Check your wallet…" : label ? label(selected) : `Continue with ${selected.name}`}</span>
        </button>
        {many && (
          <button
            type="button"
            aria-label="More wallets"
            aria-expanded={open}
            className="grid shrink-0 place-items-center self-stretch border-l border-white/30 px-4 text-white"
            onClick={() => setOpen((o) => !o)}
          >
            <ChevronDown size={20} className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {open && (
        <div className="pop-in absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-2xl bg-elev p-1.5 shadow-[var(--shadow)] ring-1 ring-line">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold hover:bg-soft"
              onClick={() => {
                setSelectedId(o.id);
                setOpen(false);
                onPick(o);
              }}
            >
              <Glyph w={o} />
              <span className="flex-1">{o.name}</span>
              {o.id === selected.id && <Check size={16} className="text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Glyph({ w }: { w: WalletOption }) {
  if (w.icon) return <Image src={w.icon} alt="" width={22} height={22} className="rounded-md" unoptimized />;
  return (
    <span className="grid h-6 w-6 place-items-center rounded-full text-white" style={{ background: w.color ?? "var(--accent-strong)" }}>
      <Wallet size={13} />
    </span>
  );
}
