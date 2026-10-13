"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Shield } from "lucide-react";
import { api } from "@/lib/client";
import { formatUsd } from "@/lib/geo";
import { SubmissionRow } from "./BountyScreen";

type Item = {
  id: string;
  videoUrl: string;
  note: string | null;
  createdAt: string;
  user: string;
  bounty: { id: string; title: string; rewardCents: number; areaName: string | null; creator: string };
};

export function ModScreen() {
  const [queue, setQueue] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    api<{ queue: Item[] }>("/api/mod").then((r) => setQueue(r.queue)).catch((e) => setError(e instanceof Error ? e.message : "Couldn't load"));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <main className="page px-5 pt-5 pb-32 lg:pb-10">
      <div className="flex items-center gap-3">
        <Link href="/bounties" className="icon-btn">
          <ChevronLeft size={18} />
        </Link>
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <Shield size={20} className="text-accent" /> Review queue
        </h1>
      </div>
      {error && <p className="mt-4 text-sm text-danger">{error}</p>}
      <div className="mt-5 space-y-3">
        {queue?.length === 0 && <div className="row-list px-4 py-8 text-center text-sm text-muted">Queue is empty. Nice.</div>}
        {queue?.map((item) => (
          <div key={item.id} className="card pop-in p-1">
            <div className="flex items-center justify-between px-4 pt-3">
              <Link href={`/bounties/${item.bounty.id}`} className="truncate text-sm font-bold text-accent">
                {item.bounty.title}
              </Link>
              <span className="text-sm font-bold">{formatUsd(item.bounty.rewardCents, { compact: true })}</span>
            </div>
            <SubmissionRow
              s={{ id: item.id, user: item.user, mine: false, videoUrl: item.videoUrl, note: item.note, status: "PENDING", reviewNote: null, payoutStatus: "PENDING", payoutTxSig: null, createdAt: item.createdAt }}
              canReview
              onChanged={load}
            />
          </div>
        ))}
      </div>
    </main>
  );
}
