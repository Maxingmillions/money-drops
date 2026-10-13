"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Shield, Trash2, Target, Coins, Users, ListChecks, Check } from "lucide-react";
import { api } from "@/lib/client";
import { formatSol } from "@/lib/geo";
import { explorerTxUrl } from "@/lib/solana";
import { SubmissionRow } from "./BountyScreen";

type QueueItem = {
  id: string;
  videoUrl: string | null;
  files: { pathname: string; contentType: string; size: number; name: string }[];
  note: string | null;
  createdAt: string;
  user: string;
  bounty: { id: string; title: string; rewardLamports: number; areaName: string | null; creator: string };
};
type Posts = {
  me: { role: string };
  campaigns: { id: string; title: string; creator: string; status: string; totalLamports: number; remainingLamports: number; remaining: number; dropCount: number; areaName: string | null; funded: boolean; createdAt: string }[];
  bounties: { id: string; title: string; creator: string; status: string; rewardLamports: number; maxWinners: number; approved: number; pending: number; areaName: string | null; funded: boolean; createdAt: string }[];
  team: { id: string; wallet: string; handle: string | null; role: string }[];
};
type Tab = "queue" | "drops" | "bounties" | "team";

export function ModScreen() {
  const [tab, setTab] = useState<Tab>("queue");
  const [queue, setQueue] = useState<QueueItem[] | null>(null);
  const [posts, setPosts] = useState<Posts | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<{ queue: QueueItem[] }>("/api/mod").then((r) => setQueue(r.queue)).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load"));
    api<Posts>("/api/mod/posts").then(setPosts).catch(() => {});
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const tabs: { id: Tab; label: string; Icon: typeof Shield; count?: number }[] = [
    { id: "queue", label: "Review", Icon: ListChecks, count: queue?.length },
    { id: "drops", label: "Drops", Icon: Coins, count: posts?.campaigns.filter((c) => c.status === "ACTIVE").length },
    { id: "bounties", label: "Bounties", Icon: Target, count: posts?.bounties.filter((b) => b.status === "OPEN").length },
    { id: "team", label: "Team", Icon: Users, count: posts?.team.length },
  ];

  return (
    <main className="page px-5 pt-5 pb-32 lg:pb-10">
      <div className="flex items-center gap-3">
        <Link href="/bounties" className="icon-btn">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Shield size={20} className="text-accent" /> Mod panel
        </h1>
      </div>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}

      <div className="mt-5 grid grid-cols-4 gap-1 rounded-2xl bg-soft p-1">
        {tabs.map(({ id, label, Icon, count }) => (
          <button key={id} className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold ${tab === id ? "bg-elev shadow" : "text-muted"}`} onClick={() => setTab(id)}>
            <Icon size={15} /> <span className="hidden sm:inline">{label}</span>
            {count != null && <span className={`rounded-full px-1.5 text-[11px] ${tab === id ? "bg-accent-soft text-accent" : "bg-line"}`}>{count}</span>}
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-3">
        {tab === "queue" && (
          <>
            {queue?.length === 0 && <Empty>Queue is empty. Nice.</Empty>}
            {queue?.map((item) => (
              <div key={item.id} className="card pop-in p-1">
                <div className="flex items-center justify-between px-4 pt-3">
                  <Link href={`/bounties/${item.bounty.id}`} className="truncate text-sm font-bold text-accent">
                    {item.bounty.title}
                  </Link>
                  <span className="text-sm font-bold">{formatSol(item.bounty.rewardLamports, { compact: true })}</span>
                </div>
                <SubmissionRow
                  s={{ id: item.id, user: item.user, mine: false, videoUrl: item.videoUrl, files: item.files, note: item.note, status: "PENDING", reviewNote: null, payoutStatus: "PENDING", payoutTxSig: null, createdAt: item.createdAt }}
                  canReview
                  onChanged={load}
                />
              </div>
            ))}
          </>
        )}

        {tab === "drops" && (
          <>
            {posts?.campaigns.length === 0 && <Empty>No live drops.</Empty>}
            {posts?.campaigns.map((c) => (
              <PostRow
                key={c.id}
                href={`/campaigns/${c.id}`}
                title={c.title}
                meta={`${c.creator} · ${c.areaName ?? "no area"} · ${c.remaining}/${c.dropCount} drops left · ${formatSol(c.remainingLamports, { compact: true })} unclaimed${c.funded ? " · on-chain" : ""}`}
                status={c.status}
                amount={formatSol(c.totalLamports, { compact: true })}
                endpoint={`/api/mod/campaigns/${c.id}`}
                canAct={c.status === "ACTIVE" || c.status === "DRAFT"}
                isAdmin={posts.me.role === "ADMIN"}
                onChanged={load}
              />
            ))}
          </>
        )}

        {tab === "bounties" && (
          <>
            {posts?.bounties.length === 0 && <Empty>No bounties.</Empty>}
            {posts?.bounties.map((b) => (
              <PostRow
                key={b.id}
                href={`/bounties/${b.id}`}
                title={b.title}
                meta={`${b.creator} · ${b.areaName ?? "anywhere"} · ${b.approved}/${b.maxWinners} paid · ${b.pending} pending${b.funded ? " · on-chain" : ""}`}
                status={b.status}
                amount={formatSol(b.rewardLamports * b.maxWinners, { compact: true })}
                endpoint={`/api/mod/bounties/${b.id}`}
                canAct={b.status === "OPEN" || b.status === "DRAFT"}
                isAdmin={posts.me.role === "ADMIN"}
                onChanged={load}
              />
            ))}
          </>
        )}

        {tab === "team" && posts && <Team team={posts.team} isAdmin={posts.me.role === "ADMIN"} onChanged={load} />}
      </div>
    </main>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="row-list px-4 py-8 text-center text-sm text-muted">{children}</div>;
}

function PostRow({ href, title, meta, status, amount, endpoint, canAct, isAdmin, onChanged }: { href: string; title: string; meta: string; status: string; amount: string; endpoint: string; canAct: boolean; isAdmin: boolean; onChanged: () => void }) {
  const [deleting, setDeleting] = useState(false);
  const [gone, setGone] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ refundedLamports: number; txSig: string | null; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pill = status === "ACTIVE" || status === "OPEN" ? "bg-success-soft text-success" : status === "REFUNDED" ? "bg-red-50 text-danger" : "bg-soft text-muted";
  return (
    <div className="card pop-in p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link href={href} className="block truncate text-[15px] font-bold hover:text-accent">
            {title}
          </Link>
          <div className="mt-0.5 text-xs text-muted">{meta}</div>
        </div>
        <span className={`pill ${pill}`}>{status.toLowerCase()}</span>
        <span className="text-sm font-bold">{amount}</span>
      </div>
      {result ? (
        <p className="mt-3 flex items-center gap-1 text-sm text-success">
          <Check size={14} /> Taken down. Refunded {formatSol(result.refundedLamports, { compact: true })} · {result.note}
          {result.txSig && (
            <a className="ml-1 underline" href={explorerTxUrl(result.txSig)} target="_blank" rel="noreferrer">
              tx ↗
            </a>
          )}
        </p>
      ) : canAct ? (
        confirm ? (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input className="input !py-2 text-sm" placeholder="Reason (shown to the creator)" value={note} onChange={(e) => setNote(e.target.value)} />
            <button
              className="btn !bg-danger !px-4 !py-2 text-sm !text-white"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const r = await api<{ refundedLamports: number; txSig: string | null; note: string }>(endpoint, { method: "POST", json: { action: "takedown", note: note || undefined } });
                  setResult(r);
                  onChanged();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Trash2 size={15} /> Confirm take down + refund
            </button>
            <button className="btn btn-secondary !px-4 !py-2 text-sm" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn btn-secondary mt-3 !px-4 !py-2 text-sm text-danger" onClick={() => setConfirm(true)}>
            <Trash2 size={15} /> Take down
          </button>
        )
      ) : null}
      {isAdmin && !gone && (
        <button
          className="mt-2 flex items-center gap-1 text-xs text-danger"
          disabled={deleting}
          onClick={async () => {
            if (!window.confirm("Delete this post completely? Unclaimed funds are refunded first.")) return;
            setDeleting(true);
            try {
              await api(endpoint, { method: "DELETE" });
              setGone(true);
              onChanged();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Delete failed");
            } finally {
              setDeleting(false);
            }
          }}
        >
          <Trash2 size={12} /> Delete permanently (admin)
        </button>
      )}
      {gone && <p className="mt-2 text-xs text-muted">Deleted.</p>}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

function Team({ team, isAdmin, onChanged }: { team: Posts["team"]; isAdmin: boolean; onChanged: () => void }) {
  const [wallet, setWallet] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const setRole = async (w: string, role: "MOD" | "USER") => {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/mod/users", { method: "POST", json: { wallet: w, role } });
      setWallet("");
      onChanged();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <div className="row-list">
        {team.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3 text-sm">
            <Shield size={15} className={u.role === "ADMIN" ? "text-accent" : "text-faint"} />
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{u.handle ?? u.wallet}</span>
            <span className="pill bg-soft text-muted">{u.role.toLowerCase()}</span>
            {isAdmin && u.role === "MOD" && (
              <button className="text-xs text-danger" disabled={busy} onClick={() => setRole(u.wallet, "USER")}>
                Remove
              </button>
            )}
          </div>
        ))}
        {team.length === 0 && <div className="px-4 py-5 text-sm text-muted">No mods yet.</div>}
      </div>
      {isAdmin ? (
        <div className="card p-4">
          <h3 className="text-sm font-semibold">Add a mod</h3>
          <div className="mt-2 flex gap-2">
            <input className="input font-mono !text-xs" placeholder="Solana wallet address" value={wallet} onChange={(e) => setWallet(e.target.value.trim())} />
            <button className="btn btn-primary !px-4 !py-2 text-sm" disabled={busy || wallet.length < 32} onClick={() => setRole(wallet, "MOD")}>
              Add
            </button>
          </div>
          {msg && <p className="mt-2 text-sm text-danger">{msg}</p>}
          <p className="mt-2 text-xs text-faint">They become a mod the next time they open the app. Admins are set with ADMIN_WALLETS.</p>
        </div>
      ) : (
        <p className="text-xs text-muted">Only admins can add or remove mods.</p>
      )}
    </div>
  );
}
