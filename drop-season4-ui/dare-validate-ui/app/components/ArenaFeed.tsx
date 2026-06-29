"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import LiveFeed from "./LiveFeed";
import AcceptDareModal from "./AcceptDareModal";

// ── Section B: GOING LIVE NOW ──────────────────────────────────────────────

type LiveCard = {
  id: number;
  user: string;
  city: string;
  dare: string;
  category: string;
  seedSeconds: number;
};

const LIVE_CARDS: LiveCard[] = [
  { id: 1, user: "kai_v",    city: "Tokyo",   dare: "Running a full marathon without stopping", category: "Physical", seedSeconds: 1847 },
  { id: 2, user: "amara_b",  city: "Lagos",   dare: "Cold calling 10 strangers for donations",  category: "Social",   seedSeconds: 432  },
  { id: 3, user: "marco_d",  city: "NYC",     dare: "Solving a Rubik's cube in under 2 minutes", category: "Speed",  seedSeconds: 78   },
];

function LiveCard({ card }: { card: LiveCard }) {
  const [elapsed, setElapsed] = useState(card.seedSeconds);

  useEffect(() => {
    const iv = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  const timeStr = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return (
    <div
      className="shrink-0 w-[80vw] snap-start rounded-2xl overflow-hidden flex flex-col p-4 gap-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Live badge + timer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
          style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <span className="relative flex h-1.5 w-1.5">
            <span className="live-dot relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
          </span>
          <span className="text-[10px] font-black text-red-400 uppercase tracking-wider">LIVE</span>
        </div>
        <span className="text-[13px] font-mono tabular-nums text-white/50">{timeStr}</span>
      </div>

      {/* User */}
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
          style={{ background: `hsl(${(card.user.charCodeAt(0) * 47) % 360}, 55%, 38%)` }}
        >
          {card.user[0].toUpperCase()}
        </div>
        <div>
          <span className="text-sm font-bold text-white">@{card.user}</span>
          <span className="text-[10px] text-white/30 ml-1.5">{card.city}</span>
        </div>
      </div>

      {/* Dare text */}
      <p className="text-[13px] text-white/70 leading-snug flex-1">{card.dare}</p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
          style={{
            background: "rgba(6,182,212,0.1)",
            border: "1px solid rgba(6,182,212,0.2)",
            color: "#22d3ee",
          }}
        >
          {card.category}
        </span>
        <button
          className="text-[11px] font-black px-3 py-1.5 rounded-xl transition-all btn-press"
          style={{
            background: "rgba(6,182,212,0.15)",
            border: "1px solid rgba(6,182,212,0.3)",
            color: "#22d3ee",
          }}
        >
          Watch
        </button>
      </div>
    </div>
  );
}

// ── Section C: OPEN DARES ──────────────────────────────────────────────────

type OpenDare = {
  id: number;
  dare: string;
  category: string;
  categoryEmoji: string;
  difficulty: string;
  rep: number;
  expiresInSeconds: number;
};

const OPEN_DARES: OpenDare[] = [
  { id: 1, dare: "Do 50 push-ups in a public place without stopping",          category: "Physical", categoryEmoji: "💪", difficulty: "Hard",   rep: 200, expiresInSeconds: 847  },
  { id: 2, dare: "Strike up a 5-minute conversation with a complete stranger", category: "Social",   categoryEmoji: "🔥", difficulty: "Medium", rep: 120, expiresInSeconds: 312  },
  { id: 3, dare: "Solve 5 sudoku puzzles in under 10 minutes",                 category: "Speed",    categoryEmoji: "⚡", difficulty: "Medium", rep: 80,  expiresInSeconds: 1440 },
];

function OpenDareCard({ od, onAccept }: { od: OpenDare; onAccept: (od: OpenDare) => void }) {
  const [secondsLeft, setSecondsLeft] = useState(od.expiresInSeconds);

  useEffect(() => {
    const iv = setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(iv);
  }, []);

  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  const timeStr = `${m}:${String(s).padStart(2, "0")}`;
  const urgent = secondsLeft < 120;

  return (
    <div
      className="shrink-0 w-[80vw] snap-start rounded-2xl flex flex-col p-4 gap-3"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: urgent ? "1px solid rgba(255,61,110,0.3)" : "1px solid rgba(255,255,255,0.07)",
      }}
    >
      {/* Dare text */}
      <p className="text-[15px] font-black text-white leading-snug">{od.dare}</p>

      {/* Category + difficulty */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
          style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)", color: "#a78bfa" }}>
          {od.categoryEmoji} {od.category}
        </span>
        <span className="text-[11px] text-white/40">{od.difficulty}</span>
      </div>

      {/* Rep + expiry */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-black text-emerald-400">+{od.rep} rep</span>
        <span className={clsx("text-[11px] font-mono tabular-nums font-bold", urgent ? "text-[var(--accent)]" : "text-white/40")}>
          Expires {timeStr}
        </span>
      </div>

      {/* Accept button */}
      <button
        onClick={() => onAccept(od)}
        className="w-full py-3 rounded-xl font-black text-sm text-white btn-press"
        style={{
          background: "linear-gradient(135deg, #ff3d6e 0%, #c026d3 100%)",
          boxShadow: "0 0 24px rgba(255,61,110,0.3)",
        }}
      >
        Accept Challenge →
      </button>
    </div>
  );
}

// ── Section A: Season pulse + main layout ──────────────────────────────────

export default function ArenaFeed() {
  const [prizePool, setPrizePool] = useState(24847);
  const [acceptedDare, setAcceptedDare] = useState<OpenDare | null>(null);

  // Prize pool ticks up
  useEffect(() => {
    function tick() {
      const delay = 2000 + Math.random() * 1000;
      const increment = Math.floor(Math.random() * 3) + 1;
      const timer = setTimeout(() => {
        setPrizePool((p) => p + increment);
        tick();
      }, delay);
      return timer;
    }
    const t = tick();
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {acceptedDare && (
        <AcceptDareModal
          dareId={acceptedDare.id}
          dare={acceptedDare.dare}
          category={acceptedDare.category}
          rep={acceptedDare.rep}
          onClose={() => setAcceptedDare(null)}
        />
      )}

      <div className="flex flex-col gap-0">
        {/* ── Section A: Season pulse strip ── */}
        <div
          className="w-full flex flex-col"
          style={{
            background: "rgba(255,61,110,0.06)",
            borderBottom: "1px solid rgba(255,61,110,0.12)",
          }}
        >
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black tracking-[0.15em] uppercase text-[var(--accent)]">
                Season 3
              </span>
              <span className="text-white/20 text-[11px]">·</span>
              <span className="text-[11px] text-white/50">15 days left</span>
              <span className="text-white/20 text-[11px]">·</span>
              <span className="text-[11px] font-black text-emerald-400">
                ${prizePool.toLocaleString()} prize pool
              </span>
            </div>
            <span className="text-[10px] text-white/25 font-mono">→</span>
          </div>
          {/* Progress bar */}
          <div className="h-0.5 w-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full"
              style={{
                width: "50%",
                background: "linear-gradient(90deg, #ff3d6e, #c026d3)",
              }}
            />
          </div>
        </div>

        {/* ── Section B: GOING LIVE NOW ── */}
        <section className="flex flex-col gap-3 pt-5">
          <div className="px-4">
            <span className="text-[11px] font-black tracking-[0.15em] uppercase text-red-400">
              Going Live Now
            </span>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide snap-x snap-mandatory">
            {LIVE_CARDS.map((card) => (
              <LiveCard key={card.id} card={card} />
            ))}
          </div>
        </section>

        {/* ── Section C: OPEN DARES ── */}
        <section className="flex flex-col gap-3 pt-5">
          <div className="px-4 flex flex-col gap-0.5">
            <span className="text-[11px] font-black tracking-[0.15em] uppercase text-[var(--accent)]">
              Open Challenges — Accept One
            </span>
            <span className="text-[10px] text-white/30">Challenges expire. Move fast.</span>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide snap-x snap-mandatory">
            {OPEN_DARES.map((od) => (
              <OpenDareCard key={od.id} od={od} onAccept={setAcceptedDare} />
            ))}
          </div>
        </section>

        {/* ── Section D: RECENT DROPS ── */}
        <section className="pt-5 pb-2">
          <LiveFeed />
        </section>
      </div>
    </>
  );
}
