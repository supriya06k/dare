"use client";

import { useEffect, useState } from "react";
import { Flame, TrendingUp, Award, ShieldCheck, ChevronRight, Info } from "lucide-react";
import { apiGet, type Me } from "../lib/api";

function sg(top: string, mid: string, bot: string, hi = 0.44) {
  return [
    `radial-gradient(ellipse 90% 55% at 50% 0%, rgba(255,255,255,${hi}) 0%, transparent 62%)`,
    `linear-gradient(170deg, ${top} 0%, ${mid} 45%, ${bot} 100%)`,
  ].join(", ");
}

const PROFILE = {
  username: "your_username",
  city: "Kondapur, Hyderabad",
  rep: 4820,
  streak: 14,
  cityRank: 7,
  playerNo: "412",
  completedTasks: 14,
  badges: [
    { label: "Speed Demon",    top: "rgba(53,189,179,0.98)",  mid: "rgba(27,139,130,0.97)", bot: "rgba(8,61,56,1.0)",   border: "rgba(100,230,220,0.72)", deep: "#0C5E57", hi: 0.45, fg: "#F2E4CC", icon: "⚡" },
    { label: "AI Slayer",      top: "rgba(245,140,160,0.98)", mid: "rgba(232,80,106,0.97)", bot: "rgba(122,18,48,1.0)", border: "rgba(255,155,175,0.72)", deep: "#7A1230", hi: 0.42, fg: "#F2E4CC", icon: "🤖" },
    { label: "Human Verified", top: "rgba(250,220,110,0.99)", mid: "rgba(240,192,64,0.98)", bot: "rgba(160,108,12,1.0)",border: "rgba(255,235,150,0.85)", deep: "#B88820", hi: 0.55, fg: "#180818", icon: "✓" },
  ],
  earnings: {
    total: 4370,
    challengesCreated: 2100,
    votesCast: 1836,
    watchCredit: 430,
    votesGiven: 612,
    challengesVerifiedByMe: 612,
    creatorsHelped: 54,
    payoutIn: 14,
  },
  poolShare: 0.0031,
};

const POOL_TOTAL = 14_847_000;

export default function ProfileCard() {
  const [me, setMe] = useState<Me | null>(null);
  const [earnings, setEarnings] = useState(PROFILE.earnings.total);
  const [votes, setVotes] = useState(PROFILE.earnings.votesGiven);
  const [showBreakdown, setShowBreakdown] = useState(false);

  /* Load the live profile from the backend (mock values are the fallback) */
  useEffect(() => {
    let alive = true;
    apiGet<Me>("/api/me").then((d) => {
      if (!alive || !d) return;
      setMe(d);
      setEarnings(d.earnings.total);
      setVotes(d.earnings.votesGiven);
    }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const cityRank = me?.cityRank ?? PROFILE.cityRank;
  const completedTasks = me?.completedTasks ?? PROFILE.completedTasks;
  const poolShare = me?.poolShare ?? PROFILE.poolShare;
  const myPoolValue = Math.round(POOL_TOTAL * poolShare);

  return (
    <div className="flex flex-col gap-4 arena-world" style={{ minHeight: "100%", padding: "20px 16px 120px" }}>

      {/* Identity — solid teal glass slab */}
      <div style={{
        background: sg("rgba(53,189,179,0.98)", "rgba(27,139,130,0.97)", "rgba(8,61,56,1.0)", 0.45),
        borderRadius: "24px",
        overflow: "hidden",
        border: "1px solid rgba(100,230,220,0.68)",
        boxShadow: [
          "inset 0 4px 0 rgba(255,255,255,0.52)",
          "inset 0 -3px 0 rgba(8,61,56,0.55)",
          "0 8px 0 #083D38",
          "0 14px 0 rgba(24,8,24,0.2)",
          "0 24px 40px rgba(24,8,24,0.28)",
        ].join(", "),
        position: "relative",
      }}>
        {/* Spotlight */}
        <div className="absolute inset-x-0 top-0 h-20 pointer-events-none" style={{
          background: "radial-gradient(ellipse 70% 100% at 50% 0%, rgba(240,192,64,0.16) 0%, transparent 100%)",
        }} />
        <div className="p-5 flex flex-col gap-4 relative z-10">
          <div className="flex items-center gap-4">
            {/* Player # — cream glass orb */}
            <div className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 68,
                height: 68,
                borderRadius: "18px",
                background: sg("rgba(255,255,255,0.18)", "rgba(242,228,204,0.97)", "rgba(210,185,155,0.98)", 0.68),
                border: "1px solid rgba(255,255,255,0.95)",
                boxShadow: [
                  "inset 0 4px 0 rgba(255,255,255,0.95)",
                  "inset 0 -3px 0 rgba(200,160,100,0.4)",
                  "0 7px 0 #C8B08A",
                  "0 12px 20px rgba(24,8,24,0.22)",
                ].join(", "),
                transform: "translateY(-3px)",
              }}>
              <span className="font-mono font-black text-center leading-none"
                style={{ fontSize: "13px", letterSpacing: "0.04em", color: "#180818" }}>
                #{PROFILE.playerNo}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-[#F2E4CC] leading-none"
                style={{ fontSize: "20px", textShadow: "0 2px 0 rgba(8,61,56,0.45)" }}>
                @{PROFILE.username}
              </p>
              <p className="text-[10px] text-[#F2E4CC]/50 mt-1">{PROFILE.city} · #{cityRank} this season</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Flame size={18} color="#F0C040" style={{ filter: "drop-shadow(0 0 6px rgba(240,192,64,0.5))" }} />
              <span className="font-black text-[#F0C040]"
                style={{ fontSize: "24px", textShadow: "0 0 14px rgba(240,192,64,0.55), 0 2px 0 rgba(184,136,32,0.5)" }}>
                {PROFILE.streak}
              </span>
            </div>
          </div>

          {/* Badges — solid glass pills */}
          <div className="flex gap-2 flex-wrap">
            {PROFILE.badges.map((b) => (
              <span key={b.label}
                className="text-[9px] font-black px-3 py-2 flex items-center gap-1.5"
                style={{
                  background: sg(b.top, b.mid, b.bot, b.hi),
                  color: b.fg,
                  borderRadius: "100px",
                  border: `1px solid ${b.border}`,
                  boxShadow: [
                    `inset 0 3px 0 rgba(255,255,255,${b.hi + 0.06})`,
                    "inset 0 -2px 0 rgba(0,0,0,0.28)",
                    `0 3px 0 ${b.deep}`,
                  ].join(", "),
                  transform: "translateY(-1px)",
                  textShadow: "0 1px 0 rgba(0,0,0,0.3)",
                }}>
                {b.icon} {b.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Earnings — solid cream glass card */}
      <div style={{
        background: sg("rgba(255,255,255,0.18)", "rgba(242,228,204,0.97)", "rgba(215,192,162,0.98)", 0.65),
        borderRadius: "24px",
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.92)",
        boxShadow: [
          "inset 0 4px 0 rgba(255,255,255,0.92)",
          "inset 0 -3px 0 rgba(200,160,100,0.3)",
          "0 8px 0 #C8B08A",
          "0 14px 0 rgba(24,8,24,0.14)",
          "0 24px 36px rgba(24,8,24,0.18)",
        ].join(", "),
      }}>
        {/* Gold top stripe — solid glass strip */}
        <div style={{
          height: 5,
          background: sg("rgba(250,220,110,0.99)", "rgba(240,192,64,0.98)", "rgba(160,108,12,1.0)", 0.55),
          boxShadow: "inset 0 2px 0 rgba(255,255,255,0.6), 0 2px 8px rgba(240,192,64,0.45)",
        }} />

        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-[#180818]/45">
              Your earnings · Season 4
            </span>
            <button onClick={() => setShowBreakdown((v) => !v)}
              className="flex items-center gap-1 text-[9px] font-black uppercase"
              style={{
                padding: "5px 12px",
                background: sg("rgba(40,16,40,0.95)", "rgba(24,8,24,0.97)", "rgba(8,4,8,0.99)", 0.12),
                borderRadius: "100px",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(242,228,204,0.7)",
                boxShadow: "inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.4)",
                cursor: "pointer",
                outline: "none",
              }}>
              <Info size={9} />
              {showBreakdown ? "Hide" : "How?"}
            </button>
          </div>

          <div className="flex items-end gap-3">
            <span className="font-black tabular-nums leading-none text-[#180818]"
              style={{ fontSize: "58px", letterSpacing: "-0.02em", textShadow: "0 4px 0 rgba(200,160,100,0.3)" }}>
              ◊{earnings.toLocaleString()}
            </span>
            <div className="mb-2">
              <p className="text-[11px] text-[#180818]/35 leading-none">of ~◊{myPoolValue.toLocaleString()} projected</p>
              <p className="text-[10px] text-[#180818]/25 mt-0.5">payout in {PROFILE.earnings.payoutIn} days</p>
            </div>
          </div>

          {/* Progress */}
          <div style={{
            height: 10,
            background: sg("rgba(200,160,100,0.3)", "rgba(180,140,80,0.18)", "rgba(200,160,100,0.1)", 0.1),
            borderRadius: "100px",
            border: "1px solid rgba(255,255,255,0.4)",
            boxShadow: "inset 0 1px 0 rgba(0,0,0,0.1)",
          }}>
            <div style={{
              height: "100%",
              width: `${Math.min((earnings / myPoolValue) * 100, 100)}%`,
              background: sg("rgba(250,220,110,0.99)", "rgba(240,192,64,0.98)", "rgba(160,108,12,1.0)", 0.55),
              borderRadius: "100px",
              boxShadow: "inset 0 2px 0 rgba(255,255,255,0.55), 2px 0 8px rgba(240,192,64,0.45)",
              transition: "width 0.8s ease",
            }} />
          </div>

          {/* Breakdown */}
          {showBreakdown && (
            <div style={{
              background: "rgba(200,160,100,0.12)",
              borderRadius: "16px",
              overflow: "hidden",
              border: "1px solid rgba(255,255,255,0.45)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.5)",
            }}>
              {[
                { label: "Challenges created", value: PROFILE.earnings.challengesCreated, sub: `${completedTasks} verified`, top: "rgba(245,140,160,0.98)", mid: "rgba(232,80,106,0.97)", bot: "rgba(122,18,48,1.0)", border: "rgba(255,155,175,0.72)", deep: "#7A1230", hi: 0.42, fg: "#F2E4CC" },
                { label: "Votes cast",          value: votes * 3,         sub: `${votes.toLocaleString()} votes`, top: "rgba(53,189,179,0.98)",  mid: "rgba(27,139,130,0.97)", bot: "rgba(8,61,56,1.0)",   border: "rgba(100,230,220,0.72)", deep: "#0C5E57", hi: 0.45, fg: "#F2E4CC" },
                { label: "Watch & engagement",  value: PROFILE.earnings.watchCredit,        sub: "passive",                         top: "rgba(100,160,224,0.98)", mid: "rgba(74,130,192,0.97)", bot: "rgba(28,60,120,1.0)", border: "rgba(140,190,240,0.72)", deep: "#284E80", hi: 0.44, fg: "#F2E4CC" },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-4 py-3.5"
                  style={{ borderBottom: "1px solid rgba(200,160,100,0.18)" }}>
                  <div>
                    <p className="text-[12px] font-black text-[#180818]">{row.label}</p>
                    <p className="text-[10px] text-[#180818]/35 mt-0.5">{row.sub}</p>
                  </div>
                  <span className="text-[14px] font-black tabular-nums px-3 py-1.5 text-[#F2E4CC]"
                    style={{
                      background: sg(row.top, row.mid, row.bot, row.hi),
                      borderRadius: "10px",
                      border: `1px solid ${row.border}`,
                      boxShadow: [
                        `inset 0 3px 0 rgba(255,255,255,${row.hi + 0.06})`,
                        "inset 0 -2px 0 rgba(0,0,0,0.28)",
                        `0 3px 0 ${row.deep}`,
                      ].join(", "),
                      transform: "translateY(-1px)",
                      textShadow: "0 1px 0 rgba(0,0,0,0.35)",
                    }}>
                    ◊{row.value.toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="px-4 py-3">
                <p className="text-[9px] text-[#180818]/30 leading-relaxed">
                  Your share: {(poolShare * 100).toFixed(2)}% of season × 30% of revenue.
                </p>
              </div>
            </div>
          )}

          {/* Impact blocks — solid glass gems */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { n: votes.toLocaleString(), label: "verified", top: "rgba(53,189,179,0.98)",  mid: "rgba(27,139,130,0.97)", bot: "rgba(8,61,56,1.0)",   border: "rgba(100,230,220,0.72)", deep: "#0C5E57", hi: 0.45, fg: "#F2E4CC" },
              { n: String(PROFILE.earnings.creatorsHelped),                  label: "paid",     top: "rgba(245,140,160,0.98)", mid: "rgba(232,80,106,0.97)", bot: "rgba(122,18,48,1.0)", border: "rgba(255,155,175,0.72)", deep: "#7A1230", hi: 0.42, fg: "#F2E4CC" },
              { n: `${(poolShare * 100).toFixed(2)}%`,               label: "of season",top: "rgba(250,220,110,0.99)", mid: "rgba(240,192,64,0.98)", bot: "rgba(160,108,12,1.0)",border: "rgba(255,235,150,0.85)", deep: "#B88820", hi: 0.55, fg: "#180818" },
            ].map((item) => (
              <div key={item.label} style={{
                background: sg(item.top, item.mid, item.bot, item.hi),
                borderRadius: "14px",
                border: `1px solid ${item.border}`,
                boxShadow: [
                  `inset 0 3px 0 rgba(255,255,255,${item.hi + 0.06})`,
                  "inset 0 -2px 0 rgba(0,0,0,0.28)",
                  `0 5px 0 ${item.deep}`,
                  "0 8px 14px rgba(24,8,24,0.18)",
                ].join(", "),
                transform: "translateY(-2px)",
                padding: "14px 8px",
                textAlign: "center",
              }}>
                <span className="block font-black tabular-nums leading-none"
                  style={{ fontSize: "18px", color: item.fg, textShadow: "0 1px 0 rgba(0,0,0,0.3)" }}>{item.n}</span>
                <span className="block text-[8px] font-black uppercase tracking-wide mt-1"
                  style={{ color: item.fg, opacity: 0.6 }}>{item.label}</span>
              </div>
            ))}
          </div>

          {/* CTA — solid dark glass */}
          <button className="w-full flex items-center justify-between px-4 py-3.5 btn-press"
            style={{
              background: sg("rgba(40,16,40,0.96)", "rgba(24,8,24,0.97)", "rgba(8,4,8,0.99)", 0.14),
              borderRadius: "14px",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "inset 0 3px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.45), 0 5px 0 rgba(0,0,0,0.4), 0 8px 14px rgba(0,0,0,0.2)",
              transform: "translateY(-2px)",
              cursor: "pointer",
              outline: "none",
            }}
            onMouseDown={(e) => { e.currentTarget.style.transform = "translateY(3px)"; e.currentTarget.style.boxShadow = "inset 0 3px 0 rgba(0,0,0,0.4), 0 1px 0 rgba(0,0,0,0.4)"; }}
            onMouseUp={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "inset 0 3px 0 rgba(255,255,255,0.14), inset 0 -2px 0 rgba(0,0,0,0.45), 0 5px 0 rgba(0,0,0,0.4), 0 8px 14px rgba(0,0,0,0.2)"; }}>
            <div>
              <p className="text-[12px] font-black text-[#F0C040] text-left"
                style={{ textShadow: "0 0 8px rgba(240,192,64,0.4), 0 1px 0 rgba(0,0,0,0.4)" }}>
                View full earnings history
              </p>
              <p className="text-[9px] text-[#F2E4CC]/35 text-left">Every session logged. Nothing hidden.</p>
            </div>
            <ChevronRight size={14} color="#F2E4CC" style={{ opacity: 0.4 }} />
          </button>
        </div>
      </div>

      {/* Trust bar — cream glass with teal left edge */}
      <div className="flex items-start gap-3 px-4 py-4"
        style={{
          background: sg("rgba(255,255,255,0.18)", "rgba(242,228,204,0.97)", "rgba(215,192,162,0.98)", 0.65),
          borderRadius: "16px",
          borderLeft: "4px solid #1B8B82",
          border: "1px solid rgba(255,255,255,0.88)",
          borderLeftWidth: "4px",
          borderLeftColor: "#1B8B82",
          boxShadow: "inset 0 3px 0 rgba(255,255,255,0.88), inset 0 -2px 0 rgba(200,160,100,0.28), 0 4px 0 #C8B08A, 0 7px 14px rgba(24,8,24,0.12)",
        }}>
        <ShieldCheck size={16} color="#1B8B82" style={{ marginTop: 2, flexShrink: 0, filter: "drop-shadow(0 0 4px rgba(27,139,130,0.4))" }} />
        <div>
          <p className="text-[12px] font-black text-[#180818]">Human-only earnings</p>
          <p className="text-[10px] text-[#180818]/40 leading-relaxed mt-0.5">
            Phone-verified · Behavior-checked each season · Bots banned permanently.
          </p>
        </div>
      </div>

      {/* Stats — solid glass gems */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Rep",        value: PROFILE.rep.toLocaleString(), top: "rgba(245,140,160,0.98)", mid: "rgba(232,80,106,0.97)", bot: "rgba(122,18,48,1.0)", border: "rgba(255,155,175,0.72)", deep: "#7A1230", hi: 0.42, icon: <TrendingUp size={14} color="#F2E4CC" style={{ filter: "drop-shadow(0 1px 0 rgba(122,18,48,0.4))" }} /> },
          { label: "Challenges", value: String(completedTasks), top: "rgba(53,189,179,0.98)", mid: "rgba(27,139,130,0.97)", bot: "rgba(8,61,56,1.0)", border: "rgba(100,230,220,0.72)", deep: "#0C5E57", hi: 0.45, icon: <Award size={14} color="#F2E4CC" style={{ filter: "drop-shadow(0 1px 0 rgba(8,61,56,0.4))" }} /> },
          { label: "City Rank",  value: `#${cityRank}`, top: "rgba(250,220,110,0.99)", mid: "rgba(240,192,64,0.98)", bot: "rgba(160,108,12,1.0)", border: "rgba(255,235,150,0.85)", deep: "#B88820", hi: 0.55, icon: <span style={{ fontSize: 14 }}>🏙</span> },
        ].map((stat) => (
          <div key={stat.label} style={{
            background: sg(stat.top, stat.mid, stat.bot, stat.hi),
            borderRadius: "18px",
            border: `1px solid ${stat.border}`,
            boxShadow: [
              `inset 0 4px 0 rgba(255,255,255,${stat.hi + 0.06})`,
              "inset 0 -3px 0 rgba(0,0,0,0.28)",
              `0 7px 0 ${stat.deep}`,
              "0 12px 20px rgba(24,8,24,0.22)",
            ].join(", "),
            transform: "translateY(-3px)",
            padding: "18px 8px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "6px",
          }}>
            {stat.icon}
            <span className="font-black leading-none text-[#F2E4CC]"
              style={{ fontSize: "22px", textShadow: "0 1px 0 rgba(0,0,0,0.3)" }}>{stat.value}</span>
            <span className="text-[8px] font-black uppercase tracking-wide text-[#F2E4CC]"
              style={{ opacity: 0.55 }}>{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
