"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Wallet, Map as MapIcon, Plus, LogOut, LineChart, Target, MessageCircle } from "lucide-react";
import { Coin } from "./Coin";
import { BottomNav } from "./BottomNav";
import { WalletPill } from "./WalletPill";
import { api } from "@/lib/client";

const items = [
  { href: "/home", label: "Wallet", Icon: Wallet },
  { href: "/map", label: "Hunt", Icon: MapIcon },
  { href: "/hide", label: "Hide money", Icon: Plus },
  { href: "/bounties", label: "Bounties", Icon: Target },
  { href: "/chat", label: "Chat", Icon: MessageCircle },
  { href: "/token", label: "$DROPS", Icon: LineChart },
];

// Full-screen flows hide the mobile bottom nav.
const NO_MOBILE_NAV = ["/hunt/", "/claim/", "/hide", "/bounties/new", "/chat"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const hideMobileNav = NO_MOBILE_NAV.some((p) => path.startsWith(p));
  return (
    <div className="shell">
      <aside className="sidebar hidden lg:flex">
        <Link href="/home" className="mb-6 flex items-center gap-3 px-2">
          <Coin size={34} />
          <span className="text-xl font-bold tracking-tight">Drops</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {items.map(({ href, label, Icon }) => (
            <Link key={href} href={href} className={`sidebar-link ${path === href || path.startsWith(href + "/") ? "active" : ""}`}>
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
        <button
          className="sidebar-link mt-auto"
          onClick={async () => {
            await api("/api/auth/signout", { method: "POST" }).catch(() => {});
            router.replace("/sign-in");
          }}
        >
          <LogOut size={18} /> Sign out
        </button>
      </aside>
      <div className="shell-main">{children}</div>
      {/* Desktop: wallet pill pinned top-right. Phones get it inline on the wallet page. */}
      <div className="pointer-events-none fixed right-6 top-4 z-30 hidden lg:block">
        <WalletPill className="pointer-events-auto" />
      </div>
      {!hideMobileNav && <BottomNav />}
    </div>
  );
}
