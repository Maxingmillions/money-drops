"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";
import { api } from "@/lib/client";
import { formatSol } from "@/lib/geo";

type Result = { refundedLamports: number; txSig: string | null; note: string };

/** "End this hunt / close this bounty and get the rest back" with a confirm step. */
export function EndPostButton({ endpoint, label, confirm, refundLamports, onDone }: { endpoint: string; label: string; confirm: string; refundLamports: number; onDone: () => void }) {
  const [step, setStep] = useState<"idle" | "confirm" | "busy" | "done">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setStep("busy");
    setError(null);
    try {
      const r = await api<Result>(endpoint, { method: "POST" });
      setResult(r);
      setStep("done");
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't do that");
      setStep("confirm");
    }
  };

  if (step === "done" && result) {
    return (
      <div className="mt-4 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
        Done. {formatSol(result.refundedLamports)} is on its way back to your wallet ({result.note}).
      </div>
    );
  }

  return (
    <div className="mt-4">
      {step === "idle" ? (
        <button className="btn btn-secondary w-full" onClick={() => setStep("confirm")}>
          <Undo2 size={16} /> {label}
        </button>
      ) : (
        <div className="card p-4">
          <p className="text-sm">{confirm}</p>
          <p className="mt-1 text-xs text-muted">
            About {formatSol(refundLamports)} comes back to the wallet that paid. The 5% posting fee isn&apos;t refunded.
          </p>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-secondary flex-1" disabled={step === "busy"} onClick={() => setStep("idle")}>
              Keep it
            </button>
            <button className="btn btn-primary flex-1" disabled={step === "busy"} onClick={run}>
              {step === "busy" ? "Working…" : "Yes, end it"}
            </button>
          </div>
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}
