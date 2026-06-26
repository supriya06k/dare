"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown, Shield, Bot, Users, ChevronRight } from "lucide-react";
import clsx from "clsx";

type Submission = {
  id: number;
  user: string;
  task: string;
  videoUrl: string;
  aiVerdict: "reject" | "uncertain";
  aiConfidence: number;
  humanVotes: { yes: number; no: number };
  timeLeft: number;
};

const SUBMISSION: Submission = {
  id: 42,
  user: "devraj_k",
  task: "Drew a portrait of a stranger in under 5 minutes",
  videoUrl: "",
  aiVerdict: "reject",
  aiConfidence: 0.61,
  humanVotes: { yes: 188, no: 44 },
  timeLeft: 87,
};

export default function VerifyArena() {
  const [sub, setSub] = useState(SUBMISSION);
  const [voted, setVoted] = useState<null | "yes" | "no">(null);
  const [suspense, setSuspense] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSub((s) => ({
        ...s,
        timeLeft: Math.max(0, s.timeLeft - 1),
        humanVotes: {
          yes: s.humanVotes.yes + (Math.random() > 0.35 ? 1 : 0),
          no: s.humanVotes.no + (Math.random() > 0.8 ? 1 : 0),
        },
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const total = sub.humanVotes.yes + sub.humanVotes.no;
  const yesPct = total > 0 ? Math.round((sub.humanVotes.yes / total) * 100) : 50;
  const humanWins = yesPct >= 60;
  const urgent = sub.timeLeft < 20;

  function vote(v: "yes" | "no") {
    if (voted) return;
    setSuspense(true);
    setVoted(v);
    setSub((s) => ({
      ...s,
      humanVotes: {
        yes: v === "yes" ? s.humanVotes.yes + 1 : s.humanVotes.yes,
        no: v === "no" ? s.humanVotes.no + 1 : s.humanVotes.no,
      },
    }));
    setTimeout(() => setSuspense(false), 800);
  }

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={14} className="text-[var(--accent-3)]" />
          <span className="text-sm font-semibold tracking-wider uppercase text-[var(--accent-3)]">
            Verify Arena
          </span>
        </div>
        <span className="text-xs text-white/30">Override the AI. You decide.</span>
      </div>

      <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--surface)] overflow-hidden">
        {/* AI Banner */}
        <div className="bg-[var(--accent)]/10 border-b border-[var(--accent)]/20 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot size={14} className="text-[var(--accent)]" />
            <span className="text-xs font-bold text-[var(--accent)]">AI REJECTED THIS</span>
            <span className="text-[10px] text-white/40">({Math.round(sub.aiConfidence * 100)}% confident)</span>
          </div>
          <div
            className={clsx(
              "text-sm font-black font-mono tabular-nums",
              urgent ? "text-[var(--accent)] animate-pulse" : "text-white/60"
            )}
          >
            {sub.timeLeft}s
          </div>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Submission */}
          <div>
            <p className="text-[11px] text-white/30 uppercase tracking-wider mb-1">Task submitted by</p>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-[10px] font-bold text-white">
                {sub.user[0].toUpperCase()}
              </div>
              <span className="font-semibold text-sm text-white">@{sub.user}</span>
            </div>
            <p className="mt-2 text-sm text-white/80 leading-snug bg-white/5 rounded-lg px-3 py-2 border border-white/8">
              "{sub.task}"
            </p>
          </div>

          {/* Video placeholder */}
          <div className="rounded-xl bg-black/40 border border-white/8 h-36 flex items-center justify-center">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-2 cursor-pointer hover:bg-white/15 transition-all">
                <ChevronRight size={20} className="text-white/60 ml-1" />
              </div>
              <p className="text-xs text-white/30">Tap to watch submission</p>
            </div>
          </div>

          {/* Vote bar */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-[11px]">
              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                <Users size={10} /> {sub.humanVotes.yes} humans say YES
              </span>
              <span className="text-red-400 font-semibold">{sub.humanVotes.no} say NO</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden flex">
              <div
                className="h-full bg-emerald-400 transition-all duration-300"
                style={{ width: `${yesPct}%` }}
              />
              <div className="h-full bg-red-400 flex-1" />
            </div>
            <p
              className={clsx(
                "text-[11px] text-center font-bold",
                humanWins ? "text-emerald-400" : "text-[var(--accent)]"
              )}
            >
              {humanWins
                ? `Humans overriding AI — ${yesPct}% approval`
                : `AI holding — humans need ${60 - yesPct}% more`}
            </p>
          </div>

          {/* Vote buttons */}
          {!voted ? (
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => vote("yes")}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-sm hover:bg-emerald-500/25 transition-all active:scale-95"
              >
                <ThumbsUp size={16} />
                LEGIT
              </button>
              <button
                onClick={() => vote("no")}
                className="flex items-center justify-center gap-2 py-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-sm hover:bg-red-500/25 transition-all active:scale-95"
              >
                <ThumbsDown size={16} />
                FAKE
              </button>
            </div>
          ) : (
            <div
              className={clsx(
                "text-center py-3 rounded-xl font-bold text-sm transition-all",
                suspense
                  ? "bg-white/10 text-white/50"
                  : voted === "yes"
                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                  : "bg-red-500/15 text-red-400 border border-red-500/30"
              )}
            >
              {suspense ? "Submitting vote…" : `Voted: ${voted === "yes" ? "LEGIT ✓" : "FAKE ✗"}`}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
