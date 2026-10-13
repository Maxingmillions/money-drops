"use client";

import { useEffect, useState } from "react";
import { SolAmount } from "./Sol";
import Link from "next/link";
import { Plus, MapPin, Clock, Video, Shield } from "lucide-react";
import { api } from "@/lib/client";
import { formatDistance } from "@/lib/geo";
import { useGeolocation } from "@/hooks/useGeolocation";

export type BountyItem = {
  id: string;
  title: string;
  description: string;
  rewardLamports: number;
  lat: number | null;
  lng: number | null;
  radiusM: number | null;
  areaName: string | null;
  deadline: string | null;
  maxWinners: number;
  status: string;
  funded: boolean;
  createdAt: string;
  creator: string;
  creatorId: string;
  distanceM: number | null;
  pending: number;
  approved: number;
};

export function BountiesScreen({ isMod, guest = false }: { isMod: boolean; guest?: boolean }) {
  const { position } = useGeolocation({ watch: false });
  const [bounties, setBounties] = useState<BountyItem[] | null>(null);
  const q = position ? `?lat=${position.lat}&lng=${position.lng}` : "";
  useEffect(() => {
    let cancelled = false;
    api<{ bounties: BountyItem[] }>(`/api/bounties${q}`).then((r) => !cancelled && setBounties(r.bounties)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <main className="page px-5 pt-6 pb-32 lg:pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{guest ? "Active bounties" : "Bounties"}</h1>
          <p className="text-sm text-muted">Go places, do things, film it, get paid.</p>
        </div>
        <div className="flex gap-2">
          {guest && (
            <Link href="/sign-in?next=%2Fbounties%2Fnew" className="btn btn-primary !px-4 !py-2.5 text-sm">
              <Plus size={16} /> Post
            </Link>
          )}
          {!guest && isMod && (
            <Link href="/mod" className="btn btn-secondary !px-3 !py-2.5 text-sm sm:!px-4" aria-label="Review queue">
              <Shield size={16} /> <span className="hidden sm:inline">Review</span>
            </Link>
          )}
          {!guest && (
            <Link href="/bounties/new" className="btn btn-primary !px-4 !py-2.5 text-sm">
              <Plus size={16} /> Post
            </Link>
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        {bounties === null && <div className="row-list h-24 animate-pulse" />}
        {bounties?.length === 0 && (
          <div className="row-list px-4 py-8 text-center text-sm text-muted">No bounties yet. Post the first one.</div>
        )}
        {bounties?.map((b) => (
          <Link key={b.id} href={guest ? `/sign-in?next=${encodeURIComponent(`/bounties/${b.id}`)}` : `/bounties/${b.id}`} className="card pop-in block p-4 transition hover:-translate-y-0.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[16px] font-bold">{b.title}</div>
                <div className="mt-0.5 line-clamp-2 text-sm text-muted">{b.description}</div>
              </div>
              <div className="shrink-0 rounded-2xl bg-accent-soft px-3 py-1.5 text-right">
                <div className="text-lg font-bold leading-tight text-accent"><SolAmount lamports={b.rewardLamports} /></div>
                <div className="text-[10px] font-semibold text-accent/70">SOL</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              {b.lat != null && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {b.areaName ?? "On location"}
                  {b.distanceM != null && ` · ${formatDistance(b.distanceM)}`}
                </span>
              )}
              {b.deadline && (
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {new Date(b.deadline).toLocaleDateString()}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Video size={12} /> {b.pending} pending · {b.approved}/{b.maxWinners} paid
              </span>
              {b.status === "COMPLETED" && <span className="pill bg-soft text-muted">Completed</span>}
              <span className="ml-auto">by {b.creator}</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
