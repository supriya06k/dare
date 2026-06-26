"use client";

import { useEffect, useState } from "react";
import { Users, Clock, AlertTriangle } from "lucide-react";
import clsx from "clsx";

const CREW = {
  name: "Night Runners",
  city: "San Francisco",
  members: [
    { name: "you", active: true, streak: 14, role: "captain" },
    { name: "marco_d", active: true, streak: 8, role: "member" },
    { name: "jay_s", active: false, streak: 3, role: "member" },
    { name: "ren_k", active: true, streak: 21, role: "member" },
    { name: "liu_x", active: false, streak: 0, role: "member" },
  ],
  challenge: {
    from: "Iron Wolves",
    city: "Oakland",
    task: "Complete 3 physical tasks across your city in 24 hours",
    expiresIn: 3600 * 18 + 40 * 60,
  },
};

export default function CrewPanel() {
  const [expiresIn, setExpiresIn] = useState(CREW.challenge.expiresIn);

  useEffect(() => {
    const interval = setInterval(() => setExpiresIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(interval);
  }, []);

  const h = Math.floor(expiresIn / 3600);
  const m = Math.floor((expiresIn % 3600) / 60);
  const urgent = expiresIn < 3600 * 2;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Users size={14} className="text-purple-400" />
        <span className="text-sm font-semibold tracking-wider uppercase text-purple-400">
          Your Crew
        </span>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white">{CREW.name}</h3>
            <p className="text-[11px] text-white/40">{CREW.city} · {CREW.members.length} members</p>
          </div>
          <span className="text-xs bg-purple-500/15 text-purple-400 border border-purple-500/25 px-2 py-1 rounded-lg font-semibold">
            #12 Regional
          </span>
        </div>

        {/* Members */}
        <div className="flex items-center gap-2">
          {CREW.members.map((m) => (
            <div key={m.name} className="flex flex-col items-center gap-1" title={m.name}>
              <div className="relative">
                <div
                  className={clsx(
                    "w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2",
                    m.name === "you"
                      ? "bg-gradient-to-br from-[var(--accent-2)] to-[var(--accent)] border-[var(--accent)] text-white"
                      : m.active
                      ? "bg-white/10 border-emerald-400/50 text-white/80"
                      : "bg-white/5 border-white/10 text-white/30"
                  )}
                >
                  {m.name[0].toUpperCase()}
                </div>
                {m.active && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[var(--surface)]" />
                )}
              </div>
              {m.streak > 0 && (
                <span className="text-[9px] text-orange-400 font-bold">🔥{m.streak}</span>
              )}
            </div>
          ))}
          <div className="ml-1 text-[10px] text-white/25">
            {CREW.members.filter((m) => m.active).length}/{CREW.members.length} active
          </div>
        </div>

        {/* Challenge notification */}
        <div
          className={clsx(
            "rounded-xl border p-3 flex flex-col gap-2",
            urgent
              ? "border-[var(--accent)]/40 bg-[var(--accent)]/8"
              : "border-yellow-500/25 bg-yellow-500/5"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle
                size={13}
                className={urgent ? "text-[var(--accent)]" : "text-yellow-400"}
              />
              <span
                className={clsx(
                  "text-[11px] font-bold uppercase tracking-wide",
                  urgent ? "text-[var(--accent)]" : "text-yellow-400"
                )}
              >
                Crew Challenge
              </span>
            </div>
            <div
              className={clsx(
                "flex items-center gap-1 font-mono text-xs font-black",
                urgent ? "text-[var(--accent)]" : "text-yellow-400"
              )}
            >
              <Clock size={10} />
              {h}h {String(m).padStart(2, "0")}m
            </div>
          </div>
          <p className="text-[11px] text-white/50">
            <span className="text-white font-semibold">{CREW.challenge.from}</span> ({CREW.challenge.city}) challenged you:
          </p>
          <p className="text-xs text-white/70 bg-white/5 rounded-lg px-2.5 py-2 border border-white/8">
            "{CREW.challenge.task}"
          </p>
          <div className="flex gap-2">
            <button className="flex-1 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 font-bold text-xs hover:bg-emerald-500/25 transition-all">
              Accept
            </button>
            <button className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-white/40 font-bold text-xs hover:bg-white/8 transition-all">
              Forfeit
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
