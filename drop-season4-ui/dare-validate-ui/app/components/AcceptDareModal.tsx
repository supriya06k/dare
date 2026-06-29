"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { apiPost, type AcceptResult, type FeedCard } from "../lib/api";

/**
 * Accept flow (ARCHITECTURE.md "ACCEPT" + "VERIFY"):
 *  1. On open we POST /api/dares/:id/accept → the server opens a real 20-minute
 *     proof deadline (and charges the entry fee for ranked dares).
 *  2. The countdown is seeded from the server's secondsLeft.
 *  3. "Submit proof" POSTs the proof → the verification engine returns a status
 *     (verified / voting / ai_rejected). Missing the deadline forfeits.
 */
export default function AcceptDareModal({
  dareId,
  dare,
  category,
  rep,
  onClose,
  onResolved,
}: {
  dareId: number;
  dare: string;
  category: string;
  rep: number;
  onClose: () => void;
  onResolved?: () => void;
}) {
  const [dropId, setDropId] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(1200);
  const [phase, setPhase] = useState<"accepting" | "ready" | "submitting" | "result">("accepting");
  const [status, setStatus] = useState<string | null>(null);

  /* Accept the dare on the backend → real deadline + entry fee. */
  useEffect(() => {
    let alive = true;
    apiPost<AcceptResult>(`/api/dares/${dareId}/accept`, {})
      .then((r) => {
        if (!alive) return;
        setDropId(r.dropId);
        setSecondsLeft(r.secondsLeft);
        setPhase("ready");
      })
      .catch(() => { if (alive) setPhase("ready"); /* offline: local countdown only */ });
    return () => { alive = false; };
  }, [dareId]);

  /* Countdown. */
  useEffect(() => {
    const iv = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, []);

  async function submitProof() {
    if (phase === "submitting" || phase === "result") return;
    setPhase("submitting");
    try {
      const card = await apiPost<FeedCard & { forfeited?: boolean }>(
        `/api/drops/${dropId}/proof`,
        { proofUrl: "claim://demo" },
      );
      setStatus(card.status ?? "voting");
    } catch {
      setStatus(null);
    }
    setPhase("result");
  }

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const verdict: Record<string, { label: string; color: string }> = {
    verified: { label: "VERIFIED ✓ — the crowd backed you", color: "#34d399" },
    voting: { label: "IN CROWD VOTE — humans decide now", color: "#ff3d6e" },
    ai_rejected: { label: "AI REJECTED — appeal via the crowd", color: "#fbbf24" },
    rejected: { label: "REJECTED — the machine won this round", color: "#f87171" },
    forfeited: { label: "FORFEITED — recorded on your profile", color: "#f87171" },
  };
  const result = status ? verdict[status] ?? { label: status.toUpperCase(), color: "#fff" } : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center sheet-enter"
      style={{ background: "rgba(0,0,0,0.95)", boxShadow: "inset 0 0 120px rgba(255,61,110,0.08)" }}
    >
      <div className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(255,20,60,0.12) 100%)" }} />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 w-full max-w-sm">
        <span className="text-[11px] font-black tracking-[0.25em] uppercase" style={{ color: "var(--accent)" }}>
          {phase === "result" ? "Verdict" : "Challenge Accepted"}
        </span>

        <div className="w-full rounded-2xl px-5 py-4 text-center"
          style={{ border: "1px solid rgba(255,61,110,0.35)", background: "rgba(255,61,110,0.06)" }}>
          <p className="text-xl font-black text-white leading-snug">{dare}</p>
        </div>

        {phase === "result" && result ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <span className="text-base font-black text-center" style={{ color: result.color }}>{result.label}</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] text-white/30 uppercase tracking-widest">You have</span>
            <span className={clsx("text-6xl font-black tabular-nums font-mono leading-none", secondsLeft < 60 ? "text-[var(--accent)]" : "text-white")}>
              {timeStr}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold px-3 py-1 rounded-full"
            style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#a78bfa" }}>
            {category}
          </span>
          <span className="text-[11px] font-bold px-3 py-1 rounded-full"
            style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.25)", color: "#34d399" }}>
            +{rep} rep
          </span>
        </div>

        {phase === "result" ? (
          <button
            onClick={() => (onResolved ?? onClose)()}
            className="w-full py-4 rounded-2xl font-black text-base text-white btn-press"
            style={{ background: "linear-gradient(135deg, #ff3d6e 0%, #c026d3 100%)", boxShadow: "0 0 40px rgba(255,61,110,0.45)" }}
          >
            DONE
          </button>
        ) : (
          <button
            onClick={submitProof}
            disabled={phase !== "ready"}
            className="w-full py-4 rounded-2xl font-black text-base text-white btn-press disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #ff3d6e 0%, #c026d3 100%)", boxShadow: "0 0 40px rgba(255,61,110,0.45), 0 4px 16px rgba(255,61,110,0.25)" }}
          >
            {phase === "accepting" ? "ACCEPTING…" : phase === "submitting" ? "SUBMITTING…" : "SUBMIT PROOF"}
          </button>
        )}

        {phase !== "result" && (
          <button onClick={onClose} className="text-[12px] text-white/25 text-center leading-relaxed">
            Back out
            <br />
            <span className="text-[10px] text-white/15">Note: forfeit is recorded on your profile</span>
          </button>
        )}
      </div>
    </div>
  );
}
