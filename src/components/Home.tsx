"use client";

import { useEffect, useState } from "react";
import { SolAmount, SolMark } from "./Sol";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { ChevronRight, Eye, EyeOff, LogOut, ArrowUp, Plus, Copy, Check, Target, Shield } from "lucide-react";
import { Coin } from "./Coin";
import { DropsTokenCard } from "./DropsToken";
import { PoolCard } from "./PoolCard";
import { PRIVY_APP_ID } from "./Providers";
import { api } from "@/lib/client";
import { formatDistance, formatSol } from "@/lib/geo";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { PublicDrop } from "@/lib/drops";
import { explorerTxUrl } from "@/lib/solana";

type Me = {
  user: { id: string; wallet: string; handle: string | null; role: string; loginMethod: string | null; email: string | null; custodial: boolean };
  totals: { foundLamports: number; paidLamports: number; pendingLamports: number; drops: number };
  claims: {
    id: string;
    amountLamports: number;
    payoutStatus: string;
    payoutTxSig: string | null;
    createdAt: string;
    campaignTitle: string;
    areaName: string | null;
  }[];
  campaigns: {
    id: string;
    title: string;
    status: string;
    totalLamports: number;
    remaining: number;
    areaName: string | null;
  }[];
};

export function Home() {
  const [me, setMe] = useState<Me | null>(null);
  const [hidden, setHidden] = useState(false);
  const [nearest, setNearest] = useState<PublicDrop | null>(null);
  const { position } = useGeolocation();

  useEffect(() => {
    api<Me>("/api/me").then(setMe).catch(() => {});
  }, []);

  useEffect(() => {
    if (!position) return;
    const url = `/api/drops/nearby?lat=${position.lat}&lng=${position.lng}&radius=5000`;
    api<{ nearest: PublicDrop | null }>(url).then((r) => setNearest(r.nearest)).catch(() => {});
  }, [position?.lat, position?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const total = me?.totals.foundLamports ?? 0;

  return (
    <main className="page px-5 pt-6 pb-32 lg:pb-10">
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-10">
      <div>
      {nearest ? (
        <Link href={`/map?drop=${nearest.id}`} className="card mb-6 flex items-center gap-3 p-3 pr-4">
          <Coin size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">
              A <SolAmount lamports={nearest.amountLamports} /> drop is {formatDistance(nearest.distanceM)} away
            </div>
            <div className="truncate text-xs text-muted">
              {nearest.campaign.areaName ? `${nearest.campaign.areaName} · ` : ""}
              {nearest.campaign.title}
            </div>
          </div>
          <ChevronRight className="text-faint" size={18} />
        </Link>
      ) : (
        <div className="mb-6 h-2" />
      )}

      <div className="flex items-center gap-2 text-sm text-muted">
        Total found
        <button onClick={() => setHidden((h) => !h)} className="text-faint" aria-label="Toggle balance">
          {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <div className="mt-1 text-[52px] font-bold leading-none tracking-tight">
        {hidden ? <><SolMark /> •••</> : (
          <>
            <SolAmount lamports={total} />
            <span className="ml-2 text-[22px] font-semibold text-faint">SOL</span>
          </>
        )}
      </div>
      {me && me.totals.pendingLamports > 0 && (
        <div className="mt-2 text-xs text-muted">
          {formatSol(me.totals.pendingLamports)} pending payout
        </div>
      )}

      <div className="mt-6 grid grid-cols-4 gap-3 lg:max-w-[440px]">
        <Action href="/map" Icon={ArrowUp} label="Hunt" rotate />
        <Action href="/hide" Icon={Plus} label="Hide" />
        <Action href="/bounties" Icon={Target} label="Bounties" />
        <WalletAction wallet={me?.user.wallet} />
      </div>
      {(me?.user.role === "MOD" || me?.user.role === "ADMIN") && (
        <Link href="/mod" className="mt-4 flex items-center gap-2 text-sm font-semibold text-accent">
          <Shield size={16} /> Open the review queue
        </Link>
      )}

      <div className="mt-8 space-y-3">
        <PoolCard />
        <DropsTokenCard />
      </div>
      </div>
      <div>

      <Section title="Found" trailing={me ? `${me.totals.drops} drops` : undefined}>
        {me?.claims.length ? (
          <div className="row-list">
            {me.claims.slice(0, 8).map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <Coin size={26} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{c.campaignTitle}</div>
                  <div className="truncate text-xs text-muted">
                    {c.areaName ?? "Somewhere"} · {new Date(c.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold"><SolAmount lamports={c.amountLamports} /></div>
                  <PayoutBadge status={c.payoutStatus} sig={c.payoutTxSig} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>Nothing found yet. Open the map and start hunting.</Empty>
        )}
      </Section>

      <Section title="Hidden by you">
        {me?.campaigns.length ? (
          <div className="row-list">
            {me.campaigns.map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{c.title}</div>
                  <div className="truncate text-xs text-muted">
                    {c.remaining} left · {c.status.toLowerCase()}
                  </div>
                </div>
                <div className="text-sm font-semibold"><SolAmount lamports={c.totalLamports} /></div>
                <ChevronRight className="text-faint" size={16} />
              </Link>
            ))}
          </div>
        ) : (
          <Empty>You haven&apos;t hidden any money yet.</Empty>
        )}
      </Section>

      <div className="lg:hidden">
        <SignOut />
      </div>
      </div>
      </div>
    </main>
  );
}

function Action({ href, Icon, label, rotate }: { href: string; Icon: typeof Plus; label: string; rotate?: boolean }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-2">
      <span className="icon-btn h-14 w-14 text-accent">
        <Icon size={22} className={rotate ? "rotate-45" : ""} />
      </span>
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}

function WalletAction({ wallet }: { wallet?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="flex flex-col items-center gap-2"
      onClick={async () => {
        if (!wallet) return;
        await navigator.clipboard.writeText(wallet).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <span className="icon-btn h-14 w-14 text-accent">{copied ? <Check size={22} /> : <Copy size={22} />}</span>
      <span className="text-xs font-medium">{wallet ? `${wallet.slice(0, 4)}…${wallet.slice(-4)}` : "Wallet"}</span>
    </button>
  );
}

function Section({ title, trailing, children }: { title: string; trailing?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        {trailing && <span className="text-sm text-muted">{trailing}</span>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="row-list px-4 py-5 text-sm text-muted">{children}</div>;
}

function PayoutBadge({ status, sig }: { status: string; sig: string | null }) {
  if (status === "PAID" && sig) {
    return (
      <a href={explorerTxUrl(sig)} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-success">
        Paid ↗
      </a>
    );
  }
  if (status === "FAILED") return <span className="text-[11px] font-medium text-danger">Payout failed</span>;
  return <span className="text-[11px] font-medium text-faint">Pending</span>;
}

function SignOut() {
  return PRIVY_APP_ID ? <PrivySignOut /> : <SignOutButton />;
}

// Privy hooks must only run inside PrivyProvider, which is mounted only when
// an app id is configured.
function PrivySignOut() {
  const { logout } = usePrivy();
  return <SignOutButton beforeRedirect={() => logout().catch(() => {})} />;
}

function SignOutButton({ beforeRedirect }: { beforeRedirect?: () => Promise<void> }) {
  const router = useRouter();
  return (
    <button
      className="mt-10 flex w-full items-center justify-center gap-2 text-sm text-muted"
      onClick={async () => {
        await api("/api/auth/signout", { method: "POST" }).catch(() => {});
        await beforeRedirect?.();
        router.replace("/sign-in");
      }}
    >
      <LogOut size={14} /> Sign out
    </button>
  );
}
