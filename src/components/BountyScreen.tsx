"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, MapPin, Clock, Video, Check, X as XIcon, ExternalLink, Shield } from "lucide-react";
import { DropMap } from "./DropMap";
import { FundWithWallet } from "./FundWithWallet";
import { PRIVY_APP_ID } from "./Providers";
import { api } from "@/lib/client";
import { formatDistance, formatUsd } from "@/lib/geo";
import { explorerTxUrl } from "@/lib/solana";
import { useGeolocation } from "@/hooks/useGeolocation";
import type { BountyItem } from "./BountiesScreen";

type Sub = {
  id: string;
  user: string;
  mine: boolean;
  videoUrl: string;
  note: string | null;
  status: string;
  reviewNote: string | null;
  payoutStatus: string;
  payoutTxSig: string | null;
  createdAt: string;
};
type Detail = {
  bounty: BountyItem;
  submissions: Sub[];
  mine: string | null;
  canReview: boolean;
  isCreator: boolean;
  funding: { treasury: string | null; memo: string; amountCents: number } | null;
};

export function BountyScreen({ id }: { id: string }) {
  const { position } = useGeolocation({ watch: false });
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const q = position ? `?lat=${position.lat}&lng=${position.lng}` : "";

  const load = useCallback(() => {
    api<Detail>(`/api/bounties/${id}${q}`).then(setData).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load"));
  }, [id, q]);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <main className="p-6 text-center text-sm text-danger">{error}</main>;
  if (!data) return <main className="p-6 text-center text-sm text-muted">Loading…</main>;
  const b = data.bounty;
  const hasLocation = b.lat != null && b.lng != null;
  const open = b.status === "OPEN";

  return (
    <main className="page px-5 pt-5 pb-32 lg:pb-10">
      <div className="flex items-center gap-3">
        <Link href="/bounties" className="icon-btn">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-bold">{b.title}</h1>
        <div className="rounded-2xl bg-accent-soft px-3 py-1.5 text-lg font-bold text-accent">{formatUsd(b.rewardCents, { compact: true })}</div>
      </div>

      <div className="mt-5 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8">
        <div>
          <p className="whitespace-pre-wrap text-[15px]">{b.description}</p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>by {b.creator}</span>
            {hasLocation && (
              <span className="flex items-center gap-1">
                <MapPin size={12} /> {b.areaName ?? "On location"}
                {b.distanceM != null && ` · ${formatDistance(b.distanceM)} away`}
              </span>
            )}
            {b.deadline && (
              <span className="flex items-center gap-1">
                <Clock size={12} /> until {new Date(b.deadline).toLocaleString()}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Video size={12} /> {b.approved}/{b.maxWinners} paid · {b.pending} pending
            </span>
            <span className="pill bg-soft text-muted">{b.status.toLowerCase()}</span>
          </div>

          {data.funding && (
            <section className="card mt-5 p-4">
              <h3 className="text-sm font-semibold">Fund this bounty to open it</h3>
              <p className="mt-1 text-xs text-muted">{formatUsd(data.funding.amountCents)} USDC is held until mods approve a winner.</p>
              {PRIVY_APP_ID && data.funding.treasury ? (
                <FundWithWallet campaignId={b.id} amountCents={data.funding.amountCents} treasury={data.funding.treasury} onFunded={load} fundPath={`/api/bounties/${b.id}/fund`} />
              ) : (
                <p className="mt-2 text-xs text-muted">Send the USDC to the escrow address with memo {b.id} (wallet funding UI needs Privy).</p>
              )}
            </section>
          )}

          {open && !data.isCreator && (
            <section className="card mt-5 p-4">
              <h3 className="text-sm font-semibold">Submit your proof</h3>
              {data.mine ? (
                <p className="mt-1 text-sm text-muted">
                  You submitted. Status: <b className="text-fg">{data.mine.toLowerCase()}</b>.
                </p>
              ) : (
                <SubmitForm bountyId={b.id} onDone={load} />
              )}
            </section>
          )}

          {(data.isCreator || data.canReview || data.submissions.length > 0) && (
            <section className="mt-6">
              <h3 className="mb-2 text-sm font-semibold">Submissions</h3>
              {data.submissions.length === 0 ? (
                <div className="row-list px-4 py-5 text-sm text-muted">Nothing submitted yet.</div>
              ) : (
                <div className="row-list">
                  {data.submissions.map((s) => (
                    <SubmissionRow key={s.id} s={s} canReview={data.canReview && open} onChanged={load} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {hasLocation && (
          <div className="card mt-6 h-[220px] overflow-hidden lg:mt-0 lg:h-[420px]">
            <DropMap center={{ lat: b.lat!, lng: b.lng! }} zoom={14} me={position} circle={{ center: { lat: b.lat!, lng: b.lng! }, radiusM: b.radiusM ?? 200 }} attribution="top-right" />
          </div>
        )}
      </div>
    </main>
  );
}

function SubmitForm({ bountyId, onDone }: { bountyId: string; onDone: () => void }) {
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-2 space-y-2">
      <input className="input" placeholder="Video link (YouTube, TikTok, X, Drive…)" value={url} onChange={(e) => setUrl(e.target.value.trim())} />
      <input className="input" placeholder="Anything the mods should know (optional)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} />
      {error && <p className="text-sm text-danger">{error}</p>}
      <button
        className="btn btn-primary w-full"
        disabled={busy || !/^https?:\/\//.test(url)}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api(`/api/bounties/${bountyId}/submit`, { method: "POST", json: { videoUrl: url, note: note || undefined } });
            onDone();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Couldn't submit");
          } finally {
            setBusy(false);
          }
        }}
      >
        <Video size={16} /> Submit for review
      </button>
      <p className="text-center text-[11px] text-faint">Mods watch the video and release the reward if it&apos;s legit.</p>
    </div>
  );
}

export function SubmissionRow({ s, canReview, onChanged }: { s: Sub; canReview: boolean; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const review = async (decision: "APPROVED" | "REJECTED") => {
    setBusy(true);
    try {
      await api(`/api/submissions/${s.id}/review`, { method: "POST", json: { decision, note: note || undefined } });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusy(false);
    }
  };
  const badge =
    s.status === "APPROVED" ? "bg-success-soft text-success" : s.status === "REJECTED" ? "bg-red-50 text-danger" : "bg-accent-soft text-accent";
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{s.mine ? "You" : s.user}</span>
        <span className={`pill ${badge}`}>{s.status.toLowerCase()}</span>
        <span className="ml-auto text-[11px] text-faint">{new Date(s.createdAt).toLocaleDateString()}</span>
      </div>
      <a href={s.videoUrl} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 truncate text-sm text-accent">
        <ExternalLink size={13} /> {s.videoUrl}
      </a>
      {s.note && <p className="mt-1 text-sm text-muted">{s.note}</p>}
      {s.reviewNote && (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <Shield size={11} /> {s.reviewNote}
        </p>
      )}
      {s.status === "APPROVED" && (
        <p className="mt-1 text-xs">
          {s.payoutStatus === "PAID" && s.payoutTxSig ? (
            <a className="text-success" href={explorerTxUrl(s.payoutTxSig)} target="_blank" rel="noreferrer">
              Paid ↗
            </a>
          ) : s.payoutStatus === "FAILED" ? (
            <span className="text-danger">Payout failed, retrying</span>
          ) : (
            <span className="text-faint">Payout pending</span>
          )}
        </p>
      )}
      {canReview && s.status === "PENDING" && (
        <div className="mt-2 flex gap-2">
          <input className="input !py-1.5 text-sm" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn btn-primary !px-3 !py-2 text-sm" disabled={busy} onClick={() => review("APPROVED")}>
            <Check size={15} /> Approve
          </button>
          <button className="btn btn-secondary !px-3 !py-2 text-sm" disabled={busy} onClick={() => review("REJECTED")}>
            <XIcon size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
