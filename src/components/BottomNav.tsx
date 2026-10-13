"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wallet, Map as MapIcon, Plus, LineChart } from "lucide-react";

const items = [
  { href: "/home", label: "Wallet", Icon: Wallet },
  { href: "/map", label: "Hunt", Icon: MapIcon },
  { href: "/hide", label: "Hide", Icon: Plus },
  { href: "/token", label: "$DROPS", Icon: LineChart },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[calc(env(safe-area-inset-bottom)+10px)] lg:hidden">
      <div className="card mx-auto flex max-w-[480px] items-center justify-around px-2 py-2">
        {items.map(({ href, label, Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 rounded-2xl px-4 py-1.5 text-[11px] font-semibold transition ${
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
