"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, Map as MapIcon, Plus } from "lucide-react";

const items = [
  { href: "/home", label: "Wallet", Icon: Wallet },
  { href: "/map", label: "Hunt", Icon: MapIcon },
  { href: "/hide", label: "Hide", Icon: Plus },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed bottom-0 left-1/2 z-30 w-full max-w-[480px] -translate-x-1/2 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)]">
      <div className="card flex items-center justify-around px-2 py-2">
        {items.map(({ href, label, Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 rounded-2xl px-5 py-1.5 text-[11px] font-semibold transition ${
                active ? "bg-accent-soft text-accent" : "text-muted hover:text-fg"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
