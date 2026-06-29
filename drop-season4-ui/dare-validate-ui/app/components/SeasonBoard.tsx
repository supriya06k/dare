"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { apiGet, type LeaderboardRow, type Season } from "../lib/api";

function sg(top: string, mid: string, bot: string, hi = 0.44) {
  return [
    `radial-gradient(ellipse 90% 55% at 50% 0%, rgba(255,255,255,${hi}) 0%, transparent 62%)`,
    `linear-gradient(170deg, ${top} 0%, ${mid} 45%, ${bot} 100%)`,
  ].join(", ");
}

type Player = {
  rank: number;
  playerNo: string;
  initials: string;
  name: string;
  city: string;
  challenges: number;
  points: number;
  earnings: number;
  votes: number;
  isMe?: boolean;
};

const FALLBACK_LEADERBOARD: Player[] = [
  { rank: 1,  playerNo: "001", initials: "PR", name: "Priya R",  city: "Banjara Hills", challenges: 34, points: 4210, earnings: 31200, votes: 3840 },
  { rank: 2,  playerNo: "047", initials: "VM", name: "Vikram M", city: "Jubilee Hills",  challenges: 28, points: 3880, earnings: 28900, votes: 3510 },
  { rank: 3,  playerNo: "096", initials: "NJ", name: "Neha J",   city: "Madhapur",       challenges: 22, points: 3540, earnings: 26400, votes: 3100 },
  { rank: 4,  playerNo: "199", initials: "RK", name: "Rohit K",  city: "Gachibowli",     challenges: 19, points: 3120, earnings: 23100, votes: 2740 },
  { rank: 5,  playerNo: "218", initials: "AS", name: "Asha S",   city: "Hitech City",    challenges: 17, points: 2870, earnings: 21400, votes: 2480 },
  { rank: 6,  playerNo: "301", initials: "DM", name: "Dev M",    city: "Kukatpally",     challenges: 16, points: 2560, earnings: 19100, votes: 2240 },
  { rank: 7,  playerNo: "412", initials: "ME", name: "You",      city: "Kondapur",       challenges: 14, points: 2140, earnings: 4370,  votes: 612, isMe: true },
  { rank: 8,  playerNo: "067", initials: "SK", name: "Sid K",    city: "Gachibowli",     challenges: 12, points: 1990, earnings: 14800, votes: 1780 },
  { rank: 9,  playerNo: "388", initials: "TN", name: "Tara N",   city: "Secunderabad",   challenges: 11, points: 1780, earnings: 13200, votes: 1540 },
  { rank: 10, playerNo: "456", initials: "KP", name: "Kiran P",  city: "Begumpet",       challenges: 9,  points: 1520, earnings: 11300, votes: 1310 },
];

const RANK_STAGE = [
  { top: "rgba(250,220,110,0.99)", mid: "rgba(240,192,64,0.98)", bot: "rgba(160,108,12,1.0)", border: "rgba(255,235,150,0.85)", deep: "#B88820", hi: 0.55, fg: "#180818" },
  { top: "rgba(195,205,215,0.99)", mid: "rgba(168,184,200,0.98)", bot: "rgba(88,112,136,1.0)", border: "rgba(220,230,240,0.82)", deep: "#607888", hi: 0.5,  fg: "#180818" },
  { top: "rgba(210,140,90,0.99)",  mid: "rgba(200,120,64,0.98)",  bot: "rgba(120,60,20,1.0)",  border: "rgba(230,165,120,0.8)",  deep: "#885020", hi: 0.48, fg: "#F2E4CC" },
];

export default function SeasonBoard() {
  const [prizePool, setPrizePool] = useState(14_847_000);
  const [daysLeft, setDaysLeft] = useState(12);
  const [players, setPlayers] = useState<Player[]>(FALLBACK_LEADERBOARD);
  const [viewMode, setViewMode] = useState<"earnings" | "points">("earnings");

  /* Load the season pool + leaderboard from the backend (mock is the fallback) */
  useEffect(() => {
    let alive = true;
    apiGet<Season>("/api/seasons/current").then((s) => {
      if (!alive || !s) return;
      setPrizePool(s.prizePool);
      setDaysLeft(s.daysLeft);
      return apiGet<LeaderboardRow[]>(`/api/seasons/${s.number}/leaderboard`).then((d) => {
        if (alive && d?.length) setPlayers(d as Player[]);
      });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    function tick() {
      t = setTimeout(() => { setPrizePool((p) => p + Math.floor(Math.random() * 3) + 1); tick(); }, 1800 + Math.random() * 1200);
    }
    tick();
    return () => clearTimeout(t);
  }, []);

  const communityPool = +(prizePool * 0.30).toFixed(0);
  const creatorPool   = +(prizePool * 0.50).toFixed(0);
  const platformCut   = +(prizePool * 0.20).toFixed(0);

  return (
    <div className="flex flex-col pb-28 arena-world" style={{ minHeight: "100%" }}>

      {/* Prize pool — transparent glass slab */}
      <div className="mx-4 mt-5 mb-5 relative overflow-hidden"
        style={{
          background: "rgba(27,139,130,0.25)",
          backdropFilter: "blur(20px) saturate(1.8) brightness(1.1)",
          WebkitBackdropFilter: "blur(20px) saturate(1.8) brightness(1.1)",
          borderRadius: "24px",
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

        {/* Ceiling spotlight */}
        <div className="absolute inset-x-0 top-0 h-20 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 80% 100% at 50% 0%, rgba(240,192,64,0.18) 0%, transparent 100%)" }} />

        <div className="p-5 flex flex-col gap-5 relative">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[8px] font-black uppercase tracking-[0.4em] mb-2 text-[#F2E4CC]/55"
                style={{ textShadow: "0 1px 0 rgba(8,61,56,0.5)" }}>
                SEASON PRIZE POOL · LIVE
              </p>
              <p className="font-black leading-none tabular-nums text-[#F2E4CC]"
                style={{
                  fontSize: "56px",
                  letterSpacing: "-0.02em",
                  textShadow: "0 4px 0 #083D38, 0 8px 20px rgba(8,61,56,0.5)",
                }}>
                ◊{prizePool.toLocaleString()}
              </p>
            </div>
            {/* Days — dark glass block */}
            <div className="flex flex-col items-center justify-center px-4 py-3"
              style={{
                background: sg("rgba(20,10,20,0.92)", "rgba(8,4,8,0.96)", "rgba(0,0,0,0.98)", 0.14),
                borderRadius: "14px",
                border: "1px solid rgba(255,255,255,0.12)",
                boxShadow: "inset 0 3px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.5)",
              }}>
              <span className="font-black tabular-nums leading-none text-[#F0C040]"
                style={{ fontSize: "30px", textShadow: "0 0 14px rgba(240,192,64,0.55), 0 2px 0 rgba(184,136,32,0.5)" }}>
                {daysLeft}
              </span>
              <span className="text-[8px] font-black tracking-[0.3em] text-[#F2E4CC]/35 mt-1">DAYS</span>
            </div>
          </div>

          {/* Progress */}
          <div className="h-2.5 overflow-hidden"
            style={{
              background: "rgba(8,61,56,0.5)",
              borderRadius: "100px",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "inset 0 1px 0 rgba(0,0,0,0.3)",
            }}>
            <div className="h-full transition-all duration-1000"
              style={{
                width: `${((30-daysLeft)/30)*100}%`,
                background: sg("rgba(250,220,110,0.99)", "rgba(240,192,64,0.9)", "rgba(160,108,12,0.8)", 0.5),
                borderRadius: "100px",
                boxShadow: "2px 0 8px rgba(240,192,64,0.4), inset 0 2px 0 rgba(255,255,255,0.4)",
              }} />
          </div>

          {/* 3-way split */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Voters",   pct: "30%", val: communityPool, top: "rgba(255,255,255,0.18)", mid: "rgba(242,228,204,0.97)", bot: "rgba(200,170,130,0.98)", border: "rgba(255,255,255,0.92)", deep: "#C8B08A", hi: 0.68 as number, fg: "#180818" },
              { label: "Creators", pct: "50%", val: creatorPool,   top: "rgba(245,140,160,0.98)", mid: "rgba(232,80,106,0.97)",  bot: "rgba(122,18,48,1.0)",   border: "rgba(255,155,175,0.72)", deep: "#7A1230", hi: 0.42 as number, fg: "#F2E4CC" },
              { label: "Platform", pct: "20%", val: platformCut,   top: "rgba(20,10,20,0.92)",   mid: "rgba(8,61,56,0.97)",     bot: "rgba(4,24,24,0.99)",    border: "rgba(100,230,220,0.25)", deep: "#041818", hi: 0.14 as number, fg: "#F2E4CC" },
            ].map((item) => (
              <div key={item.label}
                style={{
                  background: sg(item.top, item.mid, item.bot, item.hi),
                  borderRadius: "14px",
                  border: `1px solid ${item.border}`,
                  boxShadow: [
                    `inset 0 3px 0 rgba(255,255,255,${item.hi + 0.06})`,
                    "inset 0 -2px 0 rgba(0,0,0,0.28)",
                    `0 5px 0 ${item.deep}`,
                    "0 8px 16px rgba(24,8,24,0.2)",
                  ].join(", "),
                  transform: "translateY(-2px)",
                  padding: "14px 12px",
                }}>
                <span className="block font-black tabular-nums leading-none" style={{ fontSize: "24px", color: item.fg, textShadow: "0 1px 0 rgba(0,0,0,0.25)" }}>{item.pct}</span>
                <span className="block text-[10px] font-black tabular-nums mt-1" style={{ color: item.fg, opacity: 0.65 }}>◊{item.val.toLocaleString()}</span>
                <span className="block text-[7px] uppercase tracking-widest mt-1" style={{ color: item.fg, opacity: 0.35 }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Community note — solid gold glass */}
      <div className="mx-4 mb-5 px-4 py-3"
        style={{
          background: sg("rgba(250,220,110,0.99)", "rgba(240,192,64,0.98)", "rgba(160,108,12,1.0)", 0.55),
          borderRadius: "14px",
          border: "1px solid rgba(255,235,150,0.85)",
          boxShadow: "inset 0 3px 0 rgba(255,255,255,0.62), inset 0 -2px 0 rgba(160,108,12,0.45), 0 5px 0 #B88820, 0 8px 14px rgba(24,8,24,0.16)",
          transform: "translateY(-2px)",
        }}>
        <p className="text-[10px] font-bold text-[#180818]">
          <span className="font-black">4,821 players</span> earned this season — not just the top 10.
        </p>
      </div>

      {/* Toggle — solid glass pills */}
      <div className="flex items-center gap-2 px-4 mb-4">
        {(["earnings", "points"] as const).map((mode) => (
          <button key={mode} onClick={() => setViewMode(mode)}
            style={{
              padding: "8px 20px",
              background: viewMode === mode
                ? sg("rgba(40,16,40,0.96)", "rgba(24,8,24,0.97)", "rgba(8,4,8,0.99)", 0.14)
                : "rgba(24,8,24,0.14)",
              color: viewMode === mode ? "#F2E4CC" : "rgba(242,228,204,0.4)",
              borderRadius: "100px",
              border: viewMode === mode ? "1px solid rgba(255,255,255,0.14)" : "1px solid rgba(255,255,255,0.06)",
              boxShadow: viewMode === mode
                ? "inset 0 3px 0 rgba(255,255,255,0.12), inset 0 -2px 0 rgba(0,0,0,0.4), 0 4px 0 rgba(24,8,24,0.5)"
                : "none",
              transform: viewMode === mode ? "translateY(-1px)" : "none",
              transition: "all 0.1s ease",
              fontWeight: 900,
              fontSize: "10px",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              cursor: "pointer",
              outline: "none",
            }}>
            {mode}
          </button>
        ))}
      </div>

      {/* Leaderboard */}
      <div className="flex flex-col gap-2.5 px-4">
        {players.map((p) => {
          const rs = RANK_STAGE[p.rank - 1];
          return (
            <div key={p.rank}
              style={{
                background: p.isMe ? "rgba(255,248,238,0.18)" : "rgba(255,248,238,0.15)",
                backdropFilter: "blur(20px) saturate(1.8) brightness(1.1)",
                WebkitBackdropFilter: "blur(20px) saturate(1.8) brightness(1.1)",
                borderRadius: "16px",
                overflow: "hidden",
                position: "relative",
                border: "1px solid rgba(255,255,255,0.35)",
                boxShadow: [
                  "inset 0 2px 0 rgba(255,255,255,0.45)",
                  "inset 0 -2px 0 rgba(0,0,0,0.1)",
                  "0 6px 0 rgba(24,8,24,0.3)",
                  "0 12px 28px rgba(24,8,24,0.2)",
                ].join(", "),
                transform: p.isMe ? "translateY(-2px)" : "none",
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
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

              {/* Rank badge */}
              <div className="flex items-center justify-center shrink-0"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "10px",
                  background: rs
                    ? sg(rs.top, rs.mid, rs.bot, rs.hi)
                    : p.isMe
                      ? sg("rgba(255,255,255,0.16)", "rgba(242,228,204,0.97)", "rgba(210,185,155,0.98)", 0.68)
                      : sg("rgba(40,16,40,0.95)", "rgba(24,8,24,0.97)", "rgba(8,4,8,0.99)", 0.12),
                  border: rs
                    ? `1px solid ${rs.border}`
                    : p.isMe ? "1px solid rgba(255,255,255,0.88)" : "1px solid rgba(255,255,255,0.12)",
                  boxShadow: rs
                    ? `inset 0 3px 0 rgba(255,255,255,${rs.hi + 0.06}), inset 0 -2px 0 rgba(0,0,0,0.25), 0 3px 0 ${rs.deep}`
                    : p.isMe
                      ? "inset 0 3px 0 rgba(255,255,255,0.88), inset 0 -2px 0 rgba(200,160,100,0.3), 0 3px 0 #C8B08A"
                      : "inset 0 2px 0 rgba(255,255,255,0.14), 0 3px 0 rgba(0,0,0,0.4)",
                  transform: "translateY(-1px)",
                }}>
                <span className="text-[12px] font-black tabular-nums"
                  style={{
                    color: rs ? rs.fg : (p.isMe ? "#E8506A" : "#F2E4CC"),
                    textShadow: rs ? "0 1px 0 rgba(0,0,0,0.25)" : "0 1px 0 rgba(0,0,0,0.35)",
                  }}>
                  {p.rank}
                </span>
              </div>

              {/* Avatar */}
              <div className="flex items-center justify-center text-[12px] font-black shrink-0"
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "12px",
                  background: p.isMe
                    ? sg("rgba(255,255,255,0.16)", "rgba(242,228,204,0.97)", "rgba(210,185,155,0.98)", 0.68)
                    : sg("rgba(53,189,179,0.98)", "rgba(27,139,130,0.97)", "rgba(8,61,56,1.0)", 0.45),
                  border: p.isMe ? "1px solid rgba(255,255,255,0.88)" : "1px solid rgba(100,230,220,0.7)",
                  color: p.isMe ? "#E8506A" : "#F2E4CC",
                  boxShadow: p.isMe
                    ? "inset 0 3px 0 rgba(255,255,255,0.88), inset 0 -2px 0 rgba(200,160,100,0.3), 0 4px 0 #C8B08A"
                    : "inset 0 3px 0 rgba(255,255,255,0.5), inset 0 -2px 0 rgba(8,61,56,0.5), 0 4px 0 #0C5E57",
                  transform: "translateY(-2px)",
                  textShadow: "0 1px 0 rgba(0,0,0,0.25)",
                }}>
                {p.initials}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={clsx("text-[13px] font-black leading-none", p.isMe ? "text-[#F2E4CC]" : "text-[#180818]")}
                    style={{ textShadow: p.isMe ? "0 1px 0 rgba(122,18,48,0.4)" : "0 1px 0 rgba(255,255,255,0.4)" }}>
                    {p.name}
                  </p>
                  <span className="font-mono text-[8px] font-black px-1.5 py-0.5"
                    style={{
                      background: p.isMe ? "rgba(0,0,0,0.18)" : "rgba(24,8,24,0.07)",
                      borderRadius: "5px",
                      color: p.isMe ? "rgba(242,228,204,0.6)" : "rgba(24,8,24,0.35)",
                    }}>
                    #{p.playerNo}
                  </span>
                </div>
                <p className="text-[9px] mt-1 uppercase tracking-wide truncate"
                  style={{ color: p.isMe ? "rgba(242,228,204,0.5)" : "rgba(24,8,24,0.35)" }}>
                  {p.city} · {p.challenges}ch · {p.votes.toLocaleString()}v
                </p>
              </div>

              {/* Value */}
              <span className="text-[15px] font-black tabular-nums font-mono shrink-0"
                style={{
                  color: p.isMe ? "#F0C040" : "#180818",
                  textShadow: p.isMe ? "0 0 10px rgba(240,192,64,0.45), 0 1px 0 rgba(122,18,48,0.3)" : "0 1px 0 rgba(255,255,255,0.3)",
                }}>
                {viewMode === "earnings" ? `◊${p.earnings.toLocaleString()}` : p.points.toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-center text-[10px] py-8 px-8 leading-relaxed text-[#F2E4CC]/30">
        Everyone earned something.<br />The bigger this gets, the more every vote is worth.
      </p>
    </div>
  );
}
