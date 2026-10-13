import Link from "next/link";
import { LogIn } from "lucide-react";
import { Coin } from "@/components/Coin";
import { ExploreTabs } from "@/components/ExploreTabs";

export const metadata = { title: "Explore" };

/** Public shell: browse the map and bounties without an account. */
export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-elev px-4 py-2.5">
        <Link href="/sign-in" className="flex items-center gap-2 font-bold">
          <Coin size={28} /> Drops
        </Link>
        <ExploreTabs />
        <Link href="/sign-in" className="btn btn-primary ml-auto !px-4 !py-2 text-sm">
          <LogIn size={16} /> Sign in
        </Link>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
