"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map as MapIcon, Target } from "lucide-react";

const items = [
  { href: "/explore", label: "Map", Icon: MapIcon },
  { href: "/explore/bounties", label: "Bounties", Icon: Target },
];

export function ExploreTabs() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 rounded-full bg-soft p-1">
      {items.map(({ href, label, Icon }) => {
        const active = path === href;
        return (
          <Link key={href} href={href} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${active ? "bg-elev shadow" : "text-muted"}`}>
            <Icon size={15} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
