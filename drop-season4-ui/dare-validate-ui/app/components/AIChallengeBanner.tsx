"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Zap } from "lucide-react";

export default function AIChallengeBanner() {
  const [humanWins, setHumanWins] = useState(73);

  useEffect(() => {
    const iv = setInterval(() => {
      setHumanWins((n) => (Math.random() > 0.6 ? Math.min(n + 1, 89) : Math.max(n - 1, 60)));
    }, 3000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="mx-4 rounded-3xl overflow-hidden relative"
      style={{ background: "#1BB898", boxShadow: "0 8px 40px rgba(27,184,152,0.35)" }}>

      {/* Giant background shapes — SG geometry */}
      <div className="absolute -right-6 -top-6 w-36 h-36 rounded-full opacity-15"
        style={{ background: "#0D0D0D" }} />
      <div className="absolute right-8 bottom-0 opacity-[0.08]"
        style={{ width:0, height:0, borderLeft:"48px solid transparent", borderRight:"48px solid transparent", borderBottom:"84px solid #0D0D0D" }} />
      <div className="absolute -left-4 -bottom-4 w-24 h-24 opacity-[0.07]"
        style={{ background: "#0D0D0D" }} />

      <div className="relative px-5 pt-5 pb-4 flex flex-col gap-4">

        {/* Status pill */}
        <div className="self-start flex items-center gap-1.5 px-3 py-1 rounded-full"
          style={{ background: "rgba(13,13,13,0.15)", border: "1.5px solid rgba(13,13,13,0.2)" }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#0D0D0D" }} />
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#0D0D0D]">
            AI CHALLENGE WEEK · ACTIVE
          </span>
        </div>

        {/* Headline */}
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-1.5 text-[#0D0D0D]/50">
            HUMAN VS MACHINE
          </p>
          <h2 className="text-[32px] font-black leading-[0.88] tracking-tight text-[#0D0D0D]">
            THE MACHINE<br />
            <span style={{ color: "#E91E8C" }}>GOT HARDER.</span>
          </h2>
          <p className="text-[12px] mt-2 leading-relaxed text-[#0D0D0D]/60">
            Rejection threshold raised 40%. Humans must fight harder.
          </p>
        </div>

        {/* Scoreboard — two bold color blocks */}
        <div className="grid grid-cols-2 gap-2">
          {/* Humans — cream block */}
          <div className="rounded-2xl px-4 py-3 relative overflow-hidden"
            style={{ background: "#F5F0E8" }}>
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: "#0D0D0D" }} />
            <p className="text-[8px] font-black uppercase tracking-[0.25em] mb-1 text-[#0D0D0D]/40">HUMANS</p>
            <p className="text-[40px] font-black leading-none tabular-nums text-[#0D0D0D]">
              {humanWins}<span className="text-[20px]">%</span>
            </p>
            <p className="text-[9px] font-bold text-[#0D0D0D]/40 mt-0.5">winning</p>
          </div>
          {/* AI — pink block */}
          <div className="rounded-2xl px-4 py-3 relative overflow-hidden"
            style={{ background: "#E91E8C" }}>
            <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: "#0D0D0D" }} />
            <p className="text-[8px] font-black uppercase tracking-[0.25em] mb-1 text-white/50">AI</p>
            <p className="text-[40px] font-black leading-none tabular-nums text-[#F5F0E8]">
              {100 - humanWins}<span className="text-[20px]">%</span>
            </p>
            <p className="text-[9px] font-bold text-white/40 mt-0.5">rejecting</p>
          </div>
        </div>

        {/* CTA — solid black */}
        <button className="btn-press flex items-center justify-between px-4 py-3.5 rounded-2xl"
          style={{ background: "#0D0D0D" }}>
          <div className="flex items-center gap-2">
            <Zap size={14} color="#E91E8C" fill="#E91E8C" />
            <span className="text-sm font-black text-[#F5F0E8] tracking-wide">Join the resistance</span>
          </div>
          <ChevronRight size={14} color="rgba(245,240,232,0.4)" />
        </button>
      </div>
    </div>
  );
}
