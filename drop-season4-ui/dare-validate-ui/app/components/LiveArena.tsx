"use client";

import { useEffect, useState } from "react";
import { Eye, Check, X, Coins, Zap } from "lucide-react";
import { apiGet, apiPost, type LivePerformerDto } from "../lib/api";

const VOTE_VALUE = 3;

function sg(top: string, mid: string, bot: string, hi = 0.44) {
  return [
    `radial-gradient(ellipse 90% 55% at 50% 0%, rgba(255,255,255,${hi}) 0%, transparent 62%)`,
    `linear-gradient(170deg, ${top} 0%, ${mid} 45%, ${bot} 100%)`,
  ].join(", ");
}

type LivePerformer = {
  id: number;
  playerNo: string;
  initials: string;
  name: string;
  city: string;
  seasonRank: number;
  challenge: string;
  endsInSeconds: number;
  viewers: number;
  passVotes: number;
  failVotes: number;
  glTop: string; glMid: string; glBot: string;
  border: string;
  deep: string;
  hi: number;
};

const FALLBACK_PERFORMERS: LivePerformer[] = [
  { id: 1, playerNo: "067", initials: "SR", name: "Sana Rao",  city: "Hyderabad", seasonRank: 4,  challenge: "Walk into a shop and ask to try on 10 things",  endsInSeconds: 252, viewers: 412, passVotes: 543, failVotes: 271, glTop: "rgba(245,140,160,0.98)", glMid: "rgba(232,80,106,0.97)", glBot: "rgba(122,18,48,1.0)",  border: "rgba(255,155,175,0.72)", deep: "#7A1230", hi: 0.42 },
  { id: 2, playerNo: "199", initials: "AK", name: "Arjun K",   city: "Mumbai",    seasonRank: 11, challenge: "Order food only using hand signs",              endsInSeconds: 104, viewers: 88,  passVotes: 90,  failVotes: 86,  glTop: "rgba(53,189,179,0.98)",  glMid: "rgba(27,139,130,0.97)", glBot: "rgba(8,61,56,1.0)",    border: "rgba(100,230,220,0.72)", deep: "#0C5E57", hi: 0.45 },
  { id: 3, playerNo: "412", initials: "LM", name: "Lila M",    city: "Seoul",     seasonRank: 7,  challenge: "Get 5 strangers to do a group photo with you",  endsInSeconds: 388, viewers: 231, passVotes: 189, failVotes: 44,  glTop: "rgba(100,160,224,0.98)", glMid: "rgba(74,130,192,0.97)", glBot: "rgba(28,60,120,1.0)",  border: "rgba(140,190,240,0.72)", deep: "#284E80", hi: 0.44 },
];

function LiveCard({ p }: { p: LivePerformer }) {
  const [timeLeft, setTimeLeft] = useState(p.endsInSeconds);
  const [pass, setPass] = useState(p.passVotes);
  const [fail, setFail] = useState(p.failVotes);
  const [viewers, setViewers] = useState(p.viewers);
  const [voted, setVoted] = useState<"pass" | "fail" | null>(null);
  const [showEarned, setShowEarned] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      setTimeLeft((t) => Math.max(0, t - 1));
      if (Math.random() > 0.4) setPass((n) => n + 1);
      if (Math.random() > 0.75) setFail((n) => n + 1);
      if (Math.random() > 0.5) setViewers((n) => Math.max(0, n + Math.floor(Math.random() * 3) - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const total = pass + fail;
  const passPct = total > 0 ? Math.round((pass / total) * 100) : 50;
  const failPct = 100 - passPct;
  const m = Math.floor(timeLeft / 60);
  const s = timeLeft % 60;
  const urgent = timeLeft < 30;

  function vote(v: "pass" | "fail") {
    if (voted) return;
    setVoted(v);
    if (v === "pass") setPass((n) => n + 1); else setFail((n) => n + 1);
    setShowEarned(true);
    setTimeout(() => setShowEarned(false), 3000);
    /* Persist the live vote (earns Coins server-side). Keep the optimistic tally so the
       animated counter doesn't snap back to the persisted value. */
    apiPost(`/api/live/${p.id}/vote`, { verdict: v }).catch(() => {});
  }

  const inset = `inset 0 3px 0 rgba(255,255,255,${p.hi + 0.06}), inset 0 -3px 0 rgba(0,0,0,0.22), 0 8px 0 ${p.deep}, 0 14px 0 rgba(24,8,24,0.2), 0 24px 48px rgba(24,8,24,0.28)`;

  return (
    <div className="mx-4 mb-6"
      style={{
        background: `rgba(255,248,238,0.15)`,
        backdropFilter: "blur(20px) saturate(1.8) brightness(1.1)",
        WebkitBackdropFilter: "blur(20px) saturate(1.8) brightness(1.1)",
        borderRadius: "22px",
        overflow: "hidden",
        position: "relative",
        border: "1px solid rgba(255,255,255,0.35)",
        boxShadow: [
          "inset 0 2px 0 rgba(255,255,255,0.45)",
          "inset 0 -2px 0 rgba(0,0,0,0.1)",
          "0 6px 0 rgba(24,8,24,0.3)",
          "0 12px 28px rgba(24,8,24,0.2)",
        ].join(", "),
      }}
      onMouseEnter={(e) => {
        const shine = document.createElement('div');
        shine.style.cssText = `
          position:absolute;top:0;left:-100%;width:60%;height:100%;
          background:linear-gradient(105deg,transparent 30%,rgba(255,255,255,0.18) 50%,transparent 70%);
          transform:skewX(-15deg);transition:left 0.6s ease;pointer-events:none;z-index:10;
          border-radius:inherit;
        `;
        e.currentTarget.appendChild(shine);
        requestAnimationFrame(() => { shine.style.left = '160%'; });
        setTimeout(() => shine.remove(), 700);
      }}>

      {/* Live screen */}
      <div className="relative h-44 overflow-hidden"
        style={{
          background: [
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,255,255,0.1) 0%, transparent 55%)",
            "linear-gradient(160deg, rgba(255,255,255,0.06) 0%, rgba(8,4,16,0.9) 100%)",
          ].join(", "),
          borderBottom: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "22px 22px 0 0",
        }}>
        <div className="absolute inset-0 grid-pattern opacity-30" />

        {/* LIVE pill */}
        <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-2 z-10"
          style={{
            background: sg("rgba(220,48,48,0.98)", "rgba(180,24,24,0.97)", "rgba(100,8,8,1.0)", 0.38),
            borderRadius: "10px",
            border: "1px solid rgba(255,130,130,0.55)",
            boxShadow: "inset 0 3px 0 rgba(255,255,255,0.42), inset 0 -2px 0 rgba(80,0,0,0.5), 0 4px 0 #7A0000, 0 0 14px rgba(200,32,32,0.4)",
          }}>
          <span className="relative flex h-1.5 w-1.5">
            <span className="live-dot relative inline-flex rounded-full h-1.5 w-1.5 bg-[#F2E4CC]"
              style={{ color: "#F2E4CC" }} />
          </span>
          <span className="text-[9px] font-black text-[#F2E4CC] uppercase tracking-[0.12em]"
            style={{ textShadow: "0 1px 0 rgba(80,0,0,0.5)" }}>LIVE</span>
        </div>

        {/* Player number */}
        <div className="absolute top-3 right-3 z-10 px-3 py-1.5"
          style={{
            background: sg(p.glTop, p.glMid, p.glBot, p.hi),
            borderRadius: "10px",
            border: `1px solid ${p.border}`,
            boxShadow: `inset 0 3px 0 rgba(255,255,255,${p.hi + 0.06}), inset 0 -2px 0 rgba(0,0,0,0.3), 0 4px 0 ${p.deep}`,
          }}>
          <span className="font-mono text-[13px] font-black tracking-tight text-[#F2E4CC]"
            style={{ textShadow: "0 1px 0 rgba(0,0,0,0.4)" }}>#{p.playerNo}</span>
        </div>

        {/* Viewer count */}
        <div className="absolute top-[52px] right-3 flex items-center gap-1.5 px-2.5 py-1.5 z-10"
          style={{
            background: sg("rgba(40,16,40,0.95)", "rgba(24,8,24,0.97)", "rgba(8,4,8,0.99)", 0.12),
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "inset 0 2px 0 rgba(255,255,255,0.1), inset 0 -2px 0 rgba(0,0,0,0.4)",
          }}>
          <Eye size={9} color="#F2E4CC" />
          <span className="text-[9px] font-black text-[#F2E4CC] tabular-nums">{viewers.toLocaleString()}</span>
        </div>

        {/* Challenge text */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-12"
          style={{ background: "linear-gradient(to top, rgba(8,4,16,0.95), transparent)" }}>
          <p className="text-[13px] font-bold text-[#F2E4CC] leading-snug"
            style={{ textShadow: "0 1px 0 rgba(0,0,0,0.5)" }}>
            {p.challenge}
            <span className={urgent ? "urgent ml-2 text-[10px] font-mono" : "ml-2 text-[10px] font-mono text-[#F2E4CC]/35"}>
              · {String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
            </span>
          </p>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pt-4 pb-5 flex flex-col gap-4"
        style={{
          background: [
            "radial-gradient(ellipse 100% 30% at 50% 0%, rgba(255,255,255,0.1) 0%, transparent 50%)",
            "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.08) 100%)",
          ].join(", "),
        }}>

        <div className="flex items-center gap-3">
          {/* Avatar — solid glass badge */}
          <div className="flex-shrink-0 flex items-center justify-center text-[13px] font-black text-[#F2E4CC]"
            style={{
              width: 48,
              height: 48,
              borderRadius: "14px",
              background: sg(p.glTop, p.glMid, p.glBot, p.hi),
              border: `1px solid ${p.border}`,
              boxShadow: `inset 0 3px 0 rgba(255,255,255,${p.hi + 0.06}), inset 0 -2px 0 rgba(0,0,0,0.3), 0 5px 0 ${p.deep}`,
              transform: "translateY(-2px)",
              textShadow: "0 1px 0 rgba(0,0,0,0.4)",
            }}>
            {p.initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-black text-[#F2E4CC] leading-none"
              style={{ textShadow: "0 1px 0 rgba(0,0,0,0.3)" }}>{p.name}</p>
            <p className="text-[9px] mt-1 uppercase tracking-wide text-[#F2E4CC]/45">
              {p.city} · #{p.seasonRank} this season
            </p>
          </div>

          {/* Vote bar */}
          <div className="w-28 flex flex-col gap-1.5 shrink-0">
            <div className="h-4 flex overflow-hidden"
              style={{
                borderRadius: "6px",
                border: "1px solid rgba(255,255,255,0.25)",
                boxShadow: "inset 0 1px 0 rgba(0,0,0,0.2), 0 2px 0 rgba(0,0,0,0.2)",
              }}>
              <div className="h-full transition-all duration-500"
                style={{ width: `${passPct}%`, background: sg("rgba(53,189,179,0.98)", "rgba(27,139,130,0.97)", "rgba(8,61,56,1.0)", 0.35) }} />
              <div className="h-full flex-1"
                style={{ background: sg("rgba(245,140,160,0.98)", "rgba(232,80,106,0.97)", "rgba(122,18,48,1.0)", 0.3) }} />
            </div>
            <div className="flex justify-between text-[9px] font-black tabular-nums">
              <span style={{ color: "#35BDB3", textShadow: "0 0 6px rgba(53,189,179,0.4)" }}>{passPct}%</span>
              <span style={{ color: "rgba(242,228,204,0.35)" }}>{total.toLocaleString()}</span>
              <span style={{ color: "#F2788E", textShadow: "0 0 6px rgba(232,80,106,0.4)" }}>{failPct}%</span>
            </div>
          </div>
        </div>

        {/* Earn nudge */}
        {!voted && (
          <div className="flex items-center justify-center gap-2 py-3"
            style={{
              background: sg("rgba(53,189,179,0.98)", "rgba(27,139,130,0.97)", "rgba(8,61,56,1.0)", 0.45),
              borderRadius: "12px",
              border: "1px solid rgba(100,230,220,0.68)",
              boxShadow: "inset 0 3px 0 rgba(255,255,255,0.5), inset 0 -2px 0 rgba(8,61,56,0.5), 0 5px 0 #0C5E57",
              transform: "translateY(-1px)",
            }}>
            <Zap size={10} color="#F0C040" fill="#F0C040"
              style={{ filter: "drop-shadow(0 0 4px rgba(240,192,64,0.6))" }} />
            <span className="text-[9px] font-black text-[#F2E4CC]"
              style={{ textShadow: "0 1px 0 rgba(8,61,56,0.5)" }}>
              Vote earns <span style={{ color: "#F0C040", textShadow: "0 0 8px rgba(240,192,64,0.5)" }}>+{VOTE_VALUE} Coins</span>
            </span>
          </div>
        )}

        {voted ? (
          <div className="flex flex-col gap-2.5">
            <div className="py-4 text-center text-[13px] font-black text-[#F2E4CC] rounded-2xl"
              style={voted === "pass" ? {
                background: sg("rgba(53,189,179,0.98)", "rgba(27,139,130,0.97)", "rgba(8,61,56,1.0)", 0.45),
                border: "1px solid rgba(100,230,220,0.68)",
                boxShadow: "inset 0 3px 0 rgba(255,255,255,0.5), inset 0 -2px 0 rgba(8,61,56,0.5), 0 5px 0 #0C5E57",
                textShadow: "0 1px 0 rgba(8,61,56,0.5)",
              } : {
                background: sg("rgba(245,140,160,0.98)", "rgba(232,80,106,0.97)", "rgba(122,18,48,1.0)", 0.42),
                border: "1px solid rgba(255,155,175,0.7)",
                boxShadow: "inset 0 3px 0 rgba(255,255,255,0.48), inset 0 -2px 0 rgba(122,18,48,0.55), 0 5px 0 #7A1230",
                textShadow: "0 1px 0 rgba(122,18,48,0.5)",
              }}>
              {voted === "pass" ? `✓ PASS · ${passPct}%` : `✗ FAIL · ${failPct}%`}
            </div>
            {showEarned && (
              <div className="flex items-center justify-center gap-2 py-3 animate-slide-up rounded-2xl"
                style={{
                  background: sg("rgba(250,220,110,0.99)", "rgba(240,192,64,0.98)", "rgba(160,108,12,1.0)", 0.55),
                  border: "1px solid rgba(255,235,150,0.85)",
                  boxShadow: "inset 0 3px 0 rgba(255,255,255,0.62), inset 0 -2px 0 rgba(160,108,12,0.5), 0 5px 0 #B88820",
                }}>
                <Coins size={12} color="#180818" />
                <span className="text-[10px] font-black text-[#180818]">+{VOTE_VALUE} Coins earned</span>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => vote("pass")} className="press-teal py-4 rounded-2xl">
              <Check size={14} strokeWidth={3} /> PASS
            </button>
            <button onClick={() => vote("fail")} className="press-wall py-4 rounded-2xl">
              <X size={14} strokeWidth={3} /> FAIL
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LiveArena() {
  const [performers, setPerformers] = useState<LivePerformer[]>(FALLBACK_PERFORMERS);

  /* Load live performers from the backend (mock is the fallback) */
  useEffect(() => {
    let alive = true;
    apiGet<LivePerformerDto[]>("/api/live").then((d) => { if (alive && d?.length) setPerformers(d as LivePerformer[]); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <div className="flex flex-col arena-world-dark" style={{ minHeight: "100%" }}>
      <div className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="live-dot relative inline-flex rounded-full h-3 w-3 bg-[#C82020]"
                style={{ color: "#C82020" }} />
            </span>
            <span className="text-[14px] font-black uppercase tracking-[0.2em] text-[#F2E4CC]"
              style={{ textShadow: "0 0 16px rgba(200,32,32,0.4)" }}>
              Live Now
            </span>
          </div>
          {/* Live count — solid crimson glass pill */}
          <span className="text-[9px] font-black px-3 py-2 text-[#F2E4CC]"
            style={{
              background: sg("rgba(220,48,48,0.98)", "rgba(180,24,24,0.97)", "rgba(100,8,8,1.0)", 0.38),
              borderRadius: "100px",
              border: "1px solid rgba(255,130,130,0.52)",
              boxShadow: "inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -2px 0 rgba(80,0,0,0.5), 0 3px 0 #7A0000, 0 0 12px rgba(200,32,32,0.4)",
              textShadow: "0 1px 0 rgba(80,0,0,0.45)",
            }}>
            {performers.length} ACTIVE
          </span>
        </div>
      </div>
      <div className="pt-2">
        {performers.map((p) => <LiveCard key={p.id} p={p} />)}
      </div>
    </div>
  );
}
