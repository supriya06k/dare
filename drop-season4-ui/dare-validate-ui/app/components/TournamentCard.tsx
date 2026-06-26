"use client";

import { useEffect, useState } from "react";
import { Trophy, Users, MapPin, Zap, Lock, ChevronRight } from "lucide-react";
import clsx from "clsx";

export type Tournament = {
  id: number;
  name: string;
  city: string;
  startsIn: number;
  participants: number;
  maxParticipants: number;
  prize: string;
  tier: "open" | "ranked" | "legend";
  category: string;
};

export const TOURNAMENTS: Tournament[] = [
  { id: 1, name: "City Trials: Speed Round", city: "New York", startsIn: 3600 * 2 + 1800, participants: 312, maxParticipants: 500, prize: "$250 + City Crown", tier: "ranked", category: "Speed" },
  { id: 2, name: "Open Arena — Daily", city: "Global", startsIn: 900, participants: 1847, maxParticipants: 5000, prize: "500 Rep Points", tier: "open", category: "Mixed" },
  { id: 3, name: "Legend Task: The Impossible", city: "San Francisco", startsIn: 3600 * 24, participants: 7, maxParticipants: 20, prize: "$2,000 + Legend Badge", tier: "legend", category: "Unknown" },
];

const TIER_CONFIG = {
  open:   { grad: "from-emerald-500/20 to-cyan-500/10",   border: "border-emerald-500/20",  badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",    glow: "rgba(16,185,129,0.12)",  btnBg: "rgba(16,185,129,0.15)",  btnBorder: "rgba(16,185,129,0.3)",   btnText: "text-emerald-400" },
  ranked: { grad: "from-purple-600/20 to-violet-500/10",  border: "border-purple-500/30",   badge: "bg-purple-500/15 text-purple-400 border-purple-500/25",       glow: "rgba(124,58,237,0.15)",  btnBg: "rgba(124,58,237,0.15)",  btnBorder: "rgba(124,58,237,0.3)",   btnText: "text-purple-300" },
  legend: { grad: "from-yellow-500/20 to-orange-500/10",  border: "border-yellow-500/40",   badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",       glow: "rgba(234,179,8,0.18)",   btnBg: "rgba(234,179,8,0.15)",   btnBorder: "rgba(234,179,8,0.3)",    btnText: "text-yellow-400" },
};

export default function TournamentCard({ t }: { t: Tournament }) {
  const [timeLeft, setTimeLeft] = useState(t.startsIn);

  useEffect(() => {
    const iv = setInterval(() => setTimeLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, []);

  const h = Math.floor(timeLeft / 3600);
  const m = Math.floor((timeLeft % 3600) / 60);
  const s = timeLeft % 60;
  const fill = (t.participants / t.maxParticipants) * 100;
  const urgent = timeLeft < 900;
  const cfg = TIER_CONFIG[t.tier];

  return (
    <div
      className={clsx("relative rounded-3xl overflow-hidden border transition-all", cfg.border)}
      style={{
        background: `linear-gradient(140deg, var(--surface) 0%, #0d0d1a 100%)`,
        boxShadow: `0 0 40px ${cfg.glow}`,
      }}
    >
      {/* Gradient overlay */}
      <div className={clsx("absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none", cfg.grad)} />

      {/* Content */}
      <div className="relative p-4 flex flex-col gap-3">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              {t.tier === "legend" && <Trophy size={12} className="text-yellow-400" />}
              {t.tier === "ranked" && <Zap size={12} className="text-purple-400" fill="currentColor" />}
              <span className={clsx("text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border", cfg.badge)}>
                {t.tier}
              </span>
            </div>
            <h3 className="font-black text-[15px] text-white leading-tight">{t.name}</h3>
            <p className="text-[11px] text-white/40 flex items-center gap-1">
              <MapPin size={9} />{t.city} · {t.category}
            </p>
          </div>
          {/* Countdown */}
          <div className={clsx("text-right shrink-0", urgent ? "text-[var(--accent)]" : "text-white")}>
            <div className={clsx("font-mono font-black text-2xl tabular-nums leading-none", urgent && "animate-pulse")}>
              {h > 0 ? `${h}h ` : ""}{String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
            </div>
            <p className="text-[10px] text-white/30 mt-0.5">until start</p>
          </div>
        </div>

        {/* Fill bar */}
        <div className="flex flex-col gap-1">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${fill}%`,
                background: fill > 80 ? "var(--accent)" : fill > 50 ? "#7c3aed" : "#10b981",
                boxShadow: fill > 80 ? "0 0 8px rgba(255,61,110,0.6)" : "none",
              }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-white/30">
            <span className="flex items-center gap-1"><Users size={9} />{t.participants.toLocaleString()} in</span>
            <span>{Math.round(fill)}% full</span>
          </div>
        </div>

        {/* Prize + CTA */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wide">Prize pool</p>
            <p className="text-sm font-black text-white">{t.prize}</p>
          </div>
          <button
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black transition-all btn-press"
            style={{ background: cfg.btnBg, border: `1px solid ${cfg.btnBorder}` }}
          >
            <span className={cfg.btnText}>
              {t.tier === "legend" ? (
                <span className="flex items-center gap-1"><Lock size={10} /> Apply</span>
              ) : (
                <span className="flex items-center gap-1">Join <ChevronRight size={10} /></span>
              )}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
