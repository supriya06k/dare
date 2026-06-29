"use client";

import { useEffect, useState } from "react";
import { Eye, Check, X, Flame, Coins, Zap, Play } from "lucide-react";
import { apiGet, apiPost, type FeedCard, type VoteResult, type Season, type OpenDare } from "../lib/api";
import AcceptDareModal from "./AcceptDareModal";

function sg(top: string, mid: string, bot: string, hi = 0.44) {
  return [
    `radial-gradient(ellipse 90% 55% at 50% 0%, rgba(255,255,255,${hi}) 0%, transparent 62%)`,
    `linear-gradient(170deg, ${top} 0%, ${mid} 45%, ${bot} 100%)`,
  ].join(", ");
}

type Card = {
  id: number;
  dareId?: number;
  playerNo: string;
  title: string;
  user: string;
  city: string;
  votes: number;
  pts: number;
  duration: string;
  views: string;
  status?: string;
  verified: boolean;
  trending: boolean;
  category: string;
  glTop: string; glMid: string; glBot: string;
  border: string; hi: number; deep: string;
  poolContrib: number;
  /* visual row span to create a staggered grid */
  tall?: boolean;
};

const FALLBACK: Card[] = [
  { id: 1, playerNo: "001", title: "Sang full song in a metro",          user: "riya_hyd",  city: "Hyderabad", votes: 2100, pts: 340, duration: "0:23", views: "10.7K", verified: true,  trending: true,  category: "Social",   glTop: "rgba(245,140,160,0.98)", glMid: "rgba(232,80,106,0.97)",  glBot: "rgba(122,18,48,1.0)",  border: "rgba(255,155,175,0.72)", hi: 0.42, deep: "#7A1230", poolContrib: 6300, tall: true  },
  { id: 2, playerNo: "047", title: "Cold water bucket, 5°C",             user: "karan.b",   city: "Mumbai",    votes: 890,  pts: 210, duration: "0:41", views: "64.4M", verified: true,  trending: false, category: "Physical", glTop: "rgba(53,189,179,0.98)",  glMid: "rgba(27,139,130,0.97)",  glBot: "rgba(8,61,56,1.0)",    border: "rgba(100,230,220,0.72)", hi: 0.45, deep: "#0C5E57", poolContrib: 2670, tall: false },
  { id: 3, playerNo: "218", title: "50 pushups in a mall",               user: "leo_chen",  city: "Tokyo",     votes: 1440, pts: 280, duration: "1:12", views: "53.9M", verified: true,  trending: true,  category: "Physical", glTop: "rgba(100,160,224,0.98)", glMid: "rgba(74,130,192,0.97)",  glBot: "rgba(28,60,120,1.0)",  border: "rgba(140,190,240,0.72)", hi: 0.44, deep: "#284E80", poolContrib: 4320, tall: false },
  { id: 4, playerNo: "067", title: "Only Spanish in a restaurant",       user: "amara_b",   city: "Lagos",     votes: 632,  pts: 150, duration: "0:58", views: "6.9M",  verified: false, trending: false, category: "Social",   glTop: "rgba(250,220,110,0.99)", glMid: "rgba(240,192,64,0.98)",  glBot: "rgba(160,108,12,1.0)", border: "rgba(255,235,150,0.85)", hi: 0.55, deep: "#B88820", poolContrib: 1896, tall: true  },
  { id: 5, playerNo: "456", title: "Rubik's cube blindfolded",           user: "priya_s",   city: "Bangalore", votes: 3210, pts: 450, duration: "2:04", views: "3.2M",  verified: true,  trending: true,  category: "Speed",    glTop: "rgba(245,140,160,0.98)", glMid: "rgba(232,80,106,0.97)",  glBot: "rgba(122,18,48,1.0)",  border: "rgba(255,155,175,0.72)", hi: 0.42, deep: "#7A1230", poolContrib: 9630, tall: false },
  { id: 6, playerNo: "199", title: "Hand signs only food order",         user: "sid_k",     city: "Delhi",     votes: 1180, pts: 200, duration: "1:32", views: "21.3M", verified: true,  trending: false, category: "Social",   glTop: "rgba(53,189,179,0.98)",  glMid: "rgba(27,139,130,0.97)",  glBot: "rgba(8,61,56,1.0)",    border: "rgba(100,230,220,0.72)", hi: 0.45, deep: "#0C5E57", poolContrib: 3540, tall: false },
];

const VOTE_VALUE = 3;

function GridCard({ card, onTap }: { card: Card; onTap: () => void }) {
  return (
    <div
      onClick={onTap}
      className="relative overflow-hidden cursor-pointer"
      style={{
        borderRadius: 18,
        border: `1px solid ${card.border}`,
        background: sg(card.glTop, card.glMid, card.glBot, card.hi),
        boxShadow: [
          `inset 0 3px 0 rgba(255,255,255,${card.hi + 0.06})`,
          "inset 0 -3px 0 rgba(0,0,0,0.25)",
          `0 6px 0 ${card.deep}`,
          "0 10px 24px rgba(24,8,24,0.3)",
        ].join(", "),
        gridRow: card.tall ? "span 2" : "span 1",
        transform: "translateY(-2px)",
        transition: "transform 0.1s ease, box-shadow 0.1s ease",
      }}
      onMouseDown={(e) => {
        const t = e.currentTarget;
        t.style.transform = "translateY(2px) scale(0.98)";
        t.style.boxShadow = `inset 0 3px 0 rgba(0,0,0,0.2), 0 2px 0 ${card.deep}`;
      }}
      onMouseUp={(e) => {
        const t = e.currentTarget;
        t.style.transform = "translateY(-2px)";
        t.style.boxShadow = [
          `inset 0 3px 0 rgba(255,255,255,${card.hi + 0.06})`,
          "inset 0 -3px 0 rgba(0,0,0,0.25)",
          `0 6px 0 ${card.deep}`,
          "0 10px 24px rgba(24,8,24,0.3)",
        ].join(", ");
      }}
    >
      {/* Inner dark "screen" — like a window cut into the glass */}
      <div className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(255,255,255,0.09) 0%, transparent 55%)",
            "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(8,4,16,0.82) 100%)",
          ].join(", "),
        }} />

      {/* Structural grid lines in thumbnail */}
      <div className="absolute inset-0 grid-pattern opacity-20" />

      {/* Play icon center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: sg("rgba(255,255,255,0.18)", "rgba(242,228,204,0.92)", "rgba(210,185,155,0.96)", 0.62),
          border: "1px solid rgba(255,255,255,0.88)",
          boxShadow: [
            "inset 0 3px 0 rgba(255,255,255,0.88)",
            "inset 0 -2px 0 rgba(200,160,100,0.35)",
            `0 6px 0 ${card.deep}`,
            "0 8px 20px rgba(24,8,24,0.4)",
          ].join(", "),
          display: "flex", alignItems: "center", justifyContent: "center",
          transform: "translateY(-2px)",
        }}>
          <Play size={18} fill={card.glMid.replace(/[\d.,]+\)$/, "1)")} color={card.glMid.replace(/[\d.,]+\)$/, "1)")} style={{ marginLeft: 3 }} />
        </div>
      </div>

      {/* Category — top left */}
      <div className="absolute top-2.5 left-2.5 px-2 py-1"
        style={{
          background: "rgba(8,4,16,0.55)",
          borderRadius: 7, border: "1px solid rgba(255,255,255,0.14)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
        }}>
        <span className="text-[8px] font-black uppercase tracking-wide text-[#F2E4CC]/70">{card.category}</span>
      </div>

      {/* Verification status — a drop in the 60s crowd window is "live" (Humans vs The Machine) */}
      {card.status === "voting" && (
        <div className="absolute left-2.5 px-2 py-0.5 flex items-center gap-1 z-10"
          style={{ top: 30, background: "rgba(255,61,110,0.92)", borderRadius: 7, border: "1px solid rgba(255,160,180,0.6)", boxShadow: "0 2px 0 rgba(150,20,50,0.6)" }}>
          <span className="live-dot inline-flex rounded-full" style={{ height: 5, width: 5, background: "#F2E4CC", color: "#F2E4CC" }} />
          <span className="text-[7px] font-black uppercase tracking-wide text-[#F2E4CC]">Crowd vote</span>
        </div>
      )}

      {/* Trending badge — top right */}
      {card.trending && (
        <div className="absolute top-2.5 right-2.5 px-2 py-1 flex items-center gap-1"
          style={{
            background: sg("rgba(250,220,110,0.99)", "rgba(240,192,64,0.98)", "rgba(160,108,12,1.0)", 0.55),
            borderRadius: 8, border: "1px solid rgba(255,235,150,0.85)",
            boxShadow: "inset 0 2px 0 rgba(255,255,255,0.6), 0 3px 0 #B88820",
          }}>
          <Flame size={7} fill="#180818" color="#180818" />
          <span className="text-[8px] font-black text-[#180818]">HOT</span>
        </div>
      )}

      {/* Duration — top right when no badge */}
      {!card.trending && (
        <div className="absolute top-2.5 right-2.5 px-2 py-1"
          style={{
            background: "rgba(8,4,16,0.62)",
            borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          }}>
          <span className="text-[8px] font-mono font-black text-[#F2E4CC]/60">{card.duration}</span>
        </div>
      )}

      {/* Bottom glass overlay — title + stats */}
      <div className="absolute bottom-0 left-0 right-0 p-3"
        style={{
          background: [
            "linear-gradient(to top, rgba(8,4,16,0.88) 0%, rgba(8,4,16,0.0) 100%)",
          ].join(", "),
          borderRadius: "0 0 18px 18px",
        }}>
        <p className="text-[11px] font-black text-[#F2E4CC] leading-tight mb-1.5"
          style={{ textShadow: "0 1px 0 rgba(0,0,0,0.6)" }}>
          {card.title}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Eye size={8} color="rgba(242,228,204,0.5)" />
            <span className="text-[9px] font-black tabular-nums text-[#F2E4CC]/55">{card.views}</span>
          </div>
          <div className="flex items-center gap-1">
            <Coins size={8} color="#F0C040" style={{ filter: "drop-shadow(0 0 3px rgba(240,192,64,0.5))" }} />
            <span className="text-[8px] font-black text-[#F0C040]"
              style={{ textShadow: "0 0 6px rgba(240,192,64,0.4)" }}>
              {card.poolContrib.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function VoteModal({ card, onClose, onVoted }: { card: Card; onClose: () => void; onVoted?: (dropId: number, votes: number, poolContrib: number) => void }) {
  const [voted, setVoted] = useState<"pass" | "fail" | null>(null);
  const [showEarned, setShowEarned] = useState(false);

  async function vote(v: "pass" | "fail") {
    if (voted) return;
    setVoted(v);
    setShowEarned(true);
    setTimeout(() => setShowEarned(false), 3000);
    try {
      const r = await apiPost<VoteResult>(`/api/drops/${card.id}/vote`, { verdict: v });
      onVoted?.(card.id, r.votes, r.poolContrib);
    } catch {
      /* keep the optimistic UI even if the backend is unavailable */
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 z-40 overlay-enter"
        style={{ background: "rgba(8,4,16,0.85)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
        onClick={onClose} />

      {/* Modal card */}
      <div className="absolute bottom-0 left-0 right-0 z-50 sheet-enter"
        style={{
          background: sg("rgba(255,255,255,0.18)", "rgba(242,228,204,0.97)", "rgba(215,192,162,0.98)", 0.65),
          borderRadius: "28px 28px 0 0",
          overflow: "hidden",
          border: "1px solid rgba(255,255,255,0.88)",
          borderTopWidth: 4,
          borderTopColor: card.glTop,
          boxShadow: [
            "inset 0 4px 0 rgba(255,255,255,0.88)",
            "inset 0 -2px 0 rgba(200,160,100,0.25)",
            `0 -6px 0 ${card.deep}`,
            "0 -20px 50px rgba(24,8,24,0.4)",
          ].join(", "),
        }}>
        {/* Drag pill */}
        <div className="flex justify-center pt-3">
          <div className="w-10 h-1 rounded-full bg-[#180818]/15" />
        </div>

        <div className="px-5 pt-4 pb-10 flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5"
              style={{
                background: sg(card.glTop, card.glMid, card.glBot, card.hi),
                borderRadius: 10, border: `1px solid ${card.border}`,
                boxShadow: `inset 0 3px 0 rgba(255,255,255,${card.hi + 0.06}), 0 4px 0 ${card.deep}`,
              }}>
              <span className="font-mono text-[13px] font-black text-[#F2E4CC]"
                style={{ textShadow: "0 1px 0 rgba(0,0,0,0.4)" }}>#{card.playerNo}</span>
            </div>
            <div className="flex-1">
              <p className="text-[16px] font-black text-[#180818] leading-snug">{card.title}</p>
              <p className="text-[10px] text-[#180818]/40 mt-0.5">@{card.user} · {card.city}</p>
            </div>
          </div>

          {/* Earn nudge */}
          {!voted && (
            <div className="flex items-center justify-center gap-2 py-3"
              style={{
                background: sg("rgba(53,189,179,0.98)", "rgba(27,139,130,0.97)", "rgba(8,61,56,1.0)", 0.45),
                borderRadius: 12, border: "1px solid rgba(100,230,220,0.68)",
                boxShadow: "inset 0 3px 0 rgba(255,255,255,0.5), inset 0 -2px 0 rgba(8,61,56,0.5), 0 5px 0 #0C5E57",
                transform: "translateY(-1px)",
              }}>
              <Zap size={11} color="#F0C040" fill="#F0C040" style={{ filter: "drop-shadow(0 0 4px rgba(240,192,64,0.6))" }} />
              <p className="text-[10px] font-black text-[#F2E4CC]">
                Vote now · earn <span style={{ color: "#F0C040" }}>+{VOTE_VALUE} Coins</span>
              </p>
            </div>
          )}

          {voted ? (
            <div className="flex flex-col gap-2.5">
              <div className="py-4 text-center text-[13px] font-black text-[#F2E4CC] rounded-2xl"
                style={{
                  background: voted === "pass"
                    ? sg("rgba(53,189,179,0.98)", "rgba(27,139,130,0.97)", "rgba(8,61,56,1.0)", 0.45)
                    : sg("rgba(245,140,160,0.98)", "rgba(232,80,106,0.97)", "rgba(122,18,48,1.0)", 0.42),
                  border: voted === "pass" ? "1px solid rgba(100,230,220,0.68)" : "1px solid rgba(255,155,175,0.7)",
                  boxShadow: voted === "pass"
                    ? "inset 0 3px 0 rgba(255,255,255,0.5), 0 5px 0 #0C5E57"
                    : "inset 0 3px 0 rgba(255,255,255,0.45), 0 5px 0 #7A1230",
                  textShadow: "0 1px 0 rgba(0,0,0,0.4)",
                }}>
                {voted === "pass" ? "✓ YOU VOTED PASS" : "✗ YOU VOTED FAIL"}
              </div>
              {showEarned && (
                <div className="flex items-center justify-center gap-2 py-3 animate-slide-up rounded-2xl"
                  style={{
                    background: sg("rgba(250,220,110,0.99)", "rgba(240,192,64,0.98)", "rgba(160,108,12,1.0)", 0.55),
                    border: "1px solid rgba(255,235,150,0.85)",
                    boxShadow: "inset 0 3px 0 rgba(255,255,255,0.6), 0 5px 0 #B88820",
                  }}>
                  <Coins size={12} color="#180818" />
                  <span className="text-[11px] font-black text-[#180818]">+{VOTE_VALUE} Coins earned</span>
                </div>
              )}
              <button onClick={onClose} className="press-ink py-3 rounded-xl text-[12px]">
                Close
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => vote("pass")} className="press-teal py-4 rounded-2xl">
                <Check size={15} strokeWidth={3} /> PASS
              </button>
              <button onClick={() => vote("fail")} className="press-wall py-4 rounded-2xl">
                <X size={15} strokeWidth={3} /> FAIL
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function DareFeed({ refreshKey = 0 }: { refreshKey?: number }) {
  const [prizePool, setPrizePool] = useState(14_847_000);
  const [daysLeft, setDaysLeft] = useState(12);
  const [cards, setCards] = useState<Card[]>(FALLBACK);
  const [openDares, setOpenDares] = useState<OpenDare[]>([]);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [acceptDare, setAcceptDare] = useState<OpenDare | null>(null);
  const [localKey, setLocalKey] = useState(0);

  /* Load the feed + season pool + open dares from the backend (mock data is the fallback) */
  useEffect(() => {
    let alive = true;
    apiGet<FeedCard[]>("/api/drops").then((d) => { if (alive && d?.length) setCards(d as Card[]); }).catch(() => {});
    apiGet<Season>("/api/seasons/current").then((s) => { if (alive && s) { setPrizePool(s.prizePool); setDaysLeft(s.daysLeft); } }).catch(() => {});
    apiGet<OpenDare[]>("/api/dares").then((d) => { if (alive && d) setOpenDares(d); }).catch(() => {});
    return () => { alive = false; };
  }, [refreshKey, localKey]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    function tick() {
      t = setTimeout(() => { setPrizePool((p) => p + Math.floor(Math.random() * 3) + 1); tick(); }, 1800 + Math.random() * 1200);
    }
    tick();
    return () => clearTimeout(t);
  }, []);

  /* Reflect a persisted vote immediately on the card (pool contribution comes from the server) */
  function handleVoted(dropId: number, votes: number, poolContrib: number) {
    setCards((cs) => cs.map((c) => (c.id === dropId ? { ...c, votes, poolContrib } : c)));
  }

  return (
    <div className="flex flex-col arena-world" style={{ minHeight: "100%" }}>

      {/* Season banner */}
      <div className="mx-4 mt-5 mb-3"
        style={{
          background: sg("rgba(53,189,179,0.98)", "rgba(27,139,130,0.97)", "rgba(8,61,56,1.0)", 0.45),
          borderRadius: 18, border: "1px solid rgba(100,230,220,0.68)",
          boxShadow: [
            "inset 0 3px 0 rgba(255,255,255,0.52)",
            "inset 0 -3px 0 rgba(8,61,56,0.55)",
            "0 6px 0 #0C5E57",
            "0 10px 0 rgba(24,8,24,0.2)",
            "0 18px 36px rgba(24,8,24,0.25)",
          ].join(", "),
        }}>
        <div className="flex items-center justify-between px-5 py-3.5">
          <span className="text-[9px] font-black tracking-[0.3em] uppercase text-[#F2E4CC]/75">SEASON 4 · {daysLeft} DAYS LEFT</span>
          <span className="text-[17px] font-black tabular-nums text-[#F2E4CC]"
            style={{ textShadow: "0 2px 0 rgba(8,61,56,0.5)" }}>
            ◊{prizePool.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between px-5 py-2"
          style={{
            background: "rgba(8,61,56,0.3)",
            borderTop: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "0 0 18px 18px",
          }}>
          <p className="text-[9px] font-medium text-[#F2E4CC]/55">
            Every vote earns <span className="font-black text-[#F0C040]">+3 Coins</span>
          </p>
          <p className="text-[9px] text-[#F2E4CC]/35">80% back to players</p>
        </div>
      </div>

      {/* Open dares — accept one to start a 20-minute proof deadline (ACCEPT step) */}
      {openDares.length > 0 && (
        <div className="pt-1">
          <div className="flex items-center gap-3 px-5 pt-2 pb-2">
            <div style={{ width: 4, height: 18, borderRadius: 4, background: sg("rgba(245,140,160,0.98)", "rgba(232,80,106,0.97)", "rgba(122,18,48,1.0)", 0.42), boxShadow: "0 2px 0 #7A1230" }} />
            <span className="text-[12px] font-black uppercase tracking-[0.18em] text-[#F2E4CC]" style={{ textShadow: "0 2px 0 rgba(24,8,24,0.35)" }}>Open Dares</span>
          </div>
          <div className="flex gap-3 overflow-x-auto px-4 pb-1" style={{ scrollbarWidth: "none" }}>
            {openDares.map((d) => (
              <button key={d.id} onClick={() => setAcceptDare(d)} className="shrink-0 text-left px-4 py-3 rounded-2xl"
                style={{ minWidth: 200, background: sg(d.glTop, d.glMid, d.glBot, d.hi), border: `1px solid ${d.border}`, boxShadow: `inset 0 3px 0 rgba(255,255,255,${d.hi + 0.06}), 0 5px 0 ${d.deep}`, transform: "translateY(-2px)" }}>
                <p className="text-[12px] font-black text-[#F2E4CC] leading-snug" style={{ textShadow: "0 1px 0 rgba(0,0,0,0.4)" }}>{d.title}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[8px] font-black uppercase tracking-wide px-2 py-0.5 rounded-full text-[#180818]" style={{ background: "rgba(255,255,255,0.72)" }}>{d.category}</span>
                  <span className="text-[9px] font-black text-[#F2E4CC]">+{d.repReward} rep</span>
                  {d.isRanked && d.entryFee > 0 && <span className="text-[9px] font-black text-[#F0C040]">◊{d.entryFee} entry</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center gap-3 px-5 pt-4 pb-3">
        <div style={{
          width: 4, height: 20, borderRadius: 4,
          background: sg("rgba(250,220,110,0.99)", "rgba(240,192,64,0.98)", "rgba(160,108,12,1.0)", 0.55),
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.6), 0 3px 0 #B88820, 0 0 10px rgba(240,192,64,0.5)",
        }} />
        <span className="text-[13px] font-black uppercase tracking-[0.2em] text-[#F2E4CC]"
          style={{ textShadow: "0 2px 0 rgba(24,8,24,0.35)" }}>
          Challenges
        </span>
      </div>

      {/* 2-column staggered grid */}
      <div className="px-4 pb-8"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridAutoRows: "160px",
          gap: 10,
        }}>
        {cards.map((card) => (
          <GridCard key={card.id} card={card} onTap={() => setActiveCard(card)} />
        ))}
      </div>

      {/* Vote modal */}
      {activeCard && <VoteModal card={activeCard} onClose={() => setActiveCard(null)} onVoted={handleVoted} />}

      {/* Accept modal — accepts an open dare, then submits proof through the verification engine */}
      {acceptDare && (
        <AcceptDareModal
          dareId={acceptDare.id}
          dare={acceptDare.title}
          category={acceptDare.category}
          rep={acceptDare.repReward}
          onClose={() => setAcceptDare(null)}
          onResolved={() => { setAcceptDare(null); setLocalKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}
