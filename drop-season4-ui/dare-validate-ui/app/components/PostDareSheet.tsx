"use client";

import { useEffect, useRef, useState } from "react";
import { X, ChevronRight, ChevronLeft, Zap, Clock, Eye, EyeOff, Trophy } from "lucide-react";
import clsx from "clsx";
import { apiPost, type CreatedDare } from "../lib/api";

function sg(top: string, mid: string, bot: string, hi = 0.44) {
  return [
    `radial-gradient(ellipse 90% 55% at 50% 0%, rgba(255,255,255,${hi}) 0%, transparent 62%)`,
    `linear-gradient(170deg, ${top} 0%, ${mid} 45%, ${bot} 100%)`,
  ].join(", ");
}

const CATEGORIES = [
  { id: "physical", emoji: "💪", label: "Physical", top: "rgba(245,140,160,0.98)", mid: "rgba(232,80,106,0.97)", bot: "rgba(122,18,48,1.0)", border: "rgba(255,155,175,0.72)", deep: "#7A1230", hi: 0.42, fg: "#F2E4CC" },
  { id: "speed",    emoji: "⚡", label: "Speed",    top: "rgba(53,189,179,0.98)",  mid: "rgba(27,139,130,0.97)", bot: "rgba(8,61,56,1.0)",   border: "rgba(100,230,220,0.72)", deep: "#0C5E57", hi: 0.45, fg: "#F2E4CC" },
  { id: "creative", emoji: "🎨", label: "Creative", top: "rgba(100,160,224,0.98)", mid: "rgba(74,130,192,0.97)", bot: "rgba(28,60,120,1.0)", border: "rgba(140,190,240,0.72)", deep: "#2E5580", hi: 0.44, fg: "#F2E4CC" },
  { id: "social",   emoji: "🔥", label: "Social",   top: "rgba(250,220,110,0.99)", mid: "rgba(240,192,64,0.98)", bot: "rgba(160,108,12,1.0)",border: "rgba(255,235,150,0.85)", deep: "#B88820", hi: 0.55, fg: "#180818" },
];

const DIFFICULTIES = [
  { id: "easy",   label: "Easy",   rep: 30,  desc: "Anyone can try this",        barW: "33%",  top: "rgba(53,189,179,0.98)",  mid: "rgba(27,139,130,0.97)", bot: "rgba(8,61,56,1.0)",   border: "rgba(100,230,220,0.72)", deep: "#0C5E57", hi: 0.45, fg: "#F2E4CC" },
  { id: "medium", label: "Medium", rep: 80,  desc: "Takes real effort",          barW: "66%",  top: "rgba(250,220,110,0.99)", mid: "rgba(240,192,64,0.98)", bot: "rgba(160,108,12,1.0)",border: "rgba(255,235,150,0.85)", deep: "#B88820", hi: 0.55, fg: "#180818" },
  { id: "hard",   label: "Hard",   rep: 200, desc: "Most people will fail this", barW: "100%", top: "rgba(245,140,160,0.98)", mid: "rgba(232,80,106,0.97)", bot: "rgba(122,18,48,1.0)", border: "rgba(255,155,175,0.72)", deep: "#7A1230", hi: 0.42, fg: "#F2E4CC" },
];

const TIME_LIMITS = [
  { id: "15",  label: "15 min" },
  { id: "30",  label: "30 min" },
  { id: "60",  label: "1 hour" },
  { id: "120", label: "2 hours" },
];

const EXAMPLES = [
  "Do 50 pushups in a public place without stopping",
  "Strike up a 5-min conversation with a complete stranger",
  "Sing a full song on public transport",
  "Order food only using hand signs",
  "Get 5 strangers to take a group photo with you",
];

type Step = 1 | 2 | 3 | 4;

const STEP_META = [
  { top: "rgba(245,140,160,0.98)", mid: "rgba(232,80,106,0.97)", bot: "rgba(122,18,48,1.0)", border: "rgba(255,155,175,0.72)", deep: "#7A1230", hi: 0.42 },
  { top: "rgba(53,189,179,0.98)",  mid: "rgba(27,139,130,0.97)", bot: "rgba(8,61,56,1.0)",   border: "rgba(100,230,220,0.72)", deep: "#0C5E57", hi: 0.45 },
  { top: "rgba(250,220,110,0.99)", mid: "rgba(240,192,64,0.98)", bot: "rgba(160,108,12,1.0)",border: "rgba(255,235,150,0.85)", deep: "#B88820", hi: 0.55 },
  { top: "rgba(245,140,160,0.98)", mid: "rgba(232,80,106,0.97)", bot: "rgba(122,18,48,1.0)", border: "rgba(255,155,175,0.72)", deep: "#7A1230", hi: 0.42 },
];

function StepBar({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-2 px-5 pt-4 pb-1">
      {([1, 2, 3, 4] as Step[]).map((s) => {
        const m = STEP_META[s - 1];
        return (
          <div key={s} className="flex-1 h-2.5 overflow-hidden"
            style={{
              background: "rgba(200,160,100,0.15)",
              borderRadius: "100px",
              border: "1px solid rgba(255,255,255,0.3)",
              boxShadow: "inset 0 1px 0 rgba(200,160,100,0.18)",
            }}>
            <div className="h-full transition-all duration-500"
              style={{
                width: step >= s ? "100%" : "0%",
                background: step >= s ? sg(m.top, m.mid, m.bot, m.hi) : "transparent",
                boxShadow: step >= s ? `inset 0 2px 0 rgba(255,255,255,${m.hi + 0.06}), 0 2px 0 ${m.deep}` : "none",
                borderRadius: "100px",
              }} />
          </div>
        );
      })}
      <span className="text-[9px] font-black text-[#180818]/30 ml-1 tabular-nums shrink-0">{step}/4</span>
    </div>
  );
}

const CREAM_GLASS_BG = sg("rgba(255,255,255,0.18)", "rgba(242,228,204,0.97)", "rgba(215,192,162,0.98)", 0.65);
const CREAM_GLASS_BORDER = "rgba(255,255,255,0.92)";
const CREAM_GLASS_SHADOW = "inset 0 4px 0 rgba(255,255,255,0.92), inset 0 -3px 0 rgba(200,160,100,0.28)";

export default function PostDareSheet({ onClose, onPosted }: { onClose: () => void; onPosted?: () => void }) {
  const [step, setStep] = useState<Step>(1);
  const [closing, setClosing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);

  const [challenge, setChallenge] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [timeLimit, setTimeLimit] = useState<string | null>(null);
  const [bounty, setBounty] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [verdict, setVerdict] = useState<string | null>(null);

  const textRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (step === 1) setTimeout(() => textRef.current?.focus(), 300); }, [step]);

  function close() { setClosing(true); setTimeout(onClose, 260); }
  function next()  { setStep((s) => Math.min(s + 1, 4) as Step); }
  function back()  { setStep((s) => Math.max(s - 1, 1) as Step); }
  async function publish() {
    setPublishing(true);
    try {
      const created = await apiPost<CreatedDare>("/api/dares", {
        challenge,
        category: category ?? "",
        difficulty: difficulty ?? "",
        timeLimit: timeLimit ?? "",
        bounty,
        isPublic,
      });
      setVerdict(created.status);
      onPosted?.();
    } catch {
      /* still show the success screen even if the backend is unavailable */
    }
    setPublishing(false);
    setPublished(true);
  }

  const selectedCat  = CATEGORIES.find((c) => c.id === category);
  const selectedDiff = DIFFICULTIES.find((d) => d.id === difficulty);
  const sm = STEP_META[step - 1];
  const canStep1 = challenge.trim().length > 8;
  const canStep2 = !!category && !!difficulty && !!timeLimit;

  if (published) {
    return (
      <>
        <div className={clsx("absolute inset-0 z-40", closing ? "overlay-exit" : "overlay-enter")}
          style={{ background: "rgba(26,8,16,0.88)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }} />
        <div className={clsx("absolute bottom-0 left-0 right-0 z-50 max-h-[94%]", closing ? "sheet-exit" : "sheet-enter")}
          style={{
            background: CREAM_GLASS_BG,
            borderRadius: "28px 28px 0 0",
            overflow: "hidden",
            border: `1px solid ${CREAM_GLASS_BORDER}`,
            borderTopWidth: "4px",
            borderTopColor: "rgba(250,220,110,0.99)",
            boxShadow: `${CREAM_GLASS_SHADOW}, 0 -6px 0 #B88820, 0 -20px 50px rgba(24,8,24,0.35)`,
          }}>
          <div className="px-5 pt-8 pb-12 flex flex-col items-center gap-6 text-center">
            {/* Gold glass gem icon */}
            <div className="w-20 h-20 flex items-center justify-center text-5xl"
              style={{
                background: sg("rgba(250,220,110,0.99)", "rgba(240,192,64,0.98)", "rgba(160,108,12,1.0)", 0.55),
                borderRadius: "20px",
                border: "1px solid rgba(255,235,150,0.85)",
                boxShadow: "inset 0 4px 0 rgba(255,255,255,0.62), inset 0 -3px 0 rgba(160,108,12,0.45), 0 6px 0 #B88820, 0 10px 20px rgba(24,8,24,0.2)",
                transform: "translateY(-3px)",
              }}>
              🔥
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] mb-2 text-[#1B8B82]">Challenge is Live</p>
              <h2 className="text-[28px] font-black text-[#180818] leading-tight">Your challenge is in<br />the arena.</h2>
              <p className="text-[12px] text-[#180818]/45 mt-2 leading-relaxed max-w-[260px] mx-auto">
                Anyone can see it and accept it. You'll be notified when someone drops proof.
              </p>
            </div>
            {selectedCat && (
              <div className="w-full p-4 text-left"
                style={{
                  background: sg(selectedCat.top, selectedCat.mid, selectedCat.bot, selectedCat.hi),
                  borderRadius: "18px",
                  border: `1px solid ${selectedCat.border}`,
                  boxShadow: `inset 0 3px 0 rgba(255,255,255,${selectedCat.hi + 0.06}), inset 0 -2px 0 rgba(0,0,0,0.25), 0 6px 0 ${selectedCat.deep}, 0 10px 20px rgba(24,8,24,0.18)`,
                  transform: "translateY(-2px)",
                }}>
                <p className="text-[14px] font-black text-[#F2E4CC] leading-snug"
                  style={{ textShadow: "0 1px 0 rgba(0,0,0,0.35)" }}>"{challenge}"</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {selectedDiff && <span className="text-[9px] font-black px-2.5 py-1 text-[#F2E4CC]"
                    style={{ background: "rgba(0,0,0,0.2)", borderRadius: "100px" }}>+{selectedDiff.rep} rep</span>}
                  {timeLimit && <span className="text-[9px] text-[#F2E4CC]/60">{TIME_LIMITS.find(t => t.id === timeLimit)?.label} to complete</span>}
                </div>
              </div>
            )}
            {verdict && (
              <div className="text-[11px] font-black px-4 py-2 rounded-full"
                style={{
                  background: verdict === "verified" ? "rgba(16,185,129,0.14)" : verdict === "ai_rejected" ? "rgba(251,191,36,0.16)" : "rgba(255,61,110,0.12)",
                  border: `1px solid ${verdict === "verified" ? "rgba(16,185,129,0.4)" : verdict === "ai_rejected" ? "rgba(251,191,36,0.45)" : "rgba(255,61,110,0.4)"}`,
                  color: verdict === "verified" ? "#0F766E" : verdict === "ai_rejected" ? "#92660A" : "#B0184A",
                }}>
                AI verdict: {verdict === "verified" ? "verified ✓" : verdict === "voting" ? "in crowd vote — humans decide" : verdict === "ai_rejected" ? "rejected — crowd can override" : verdict}
              </div>
            )}
            <button onClick={close} className="press-wall w-full py-4 rounded-2xl text-[14px]">
              Back to Arena →
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={clsx("absolute inset-0 z-40", closing ? "overlay-exit" : "overlay-enter")}
        style={{ background: "rgba(26,8,16,0.85)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}
        onClick={close} />

      {/* Sheet — solid cream glass slab */}
      <div className={clsx("absolute bottom-0 left-0 right-0 z-50 max-h-[94%] flex flex-col", closing ? "sheet-exit" : "sheet-enter")}
        style={{
          background: CREAM_GLASS_BG,
          borderRadius: "28px 28px 0 0",
          overflow: "hidden",
          border: `1px solid ${CREAM_GLASS_BORDER}`,
          borderTopWidth: "4px",
          borderTopColor: sm.top,
          boxShadow: `${CREAM_GLASS_SHADOW}, 0 -6px 0 ${sm.deep}, 0 -20px 60px rgba(24,8,24,0.4)`,
        }}>

        <div className="flex justify-center pt-3 shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#180818]/15" />
        </div>

        <StepBar step={step} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-3 pb-1 shrink-0">
          <button onClick={step === 1 ? close : back}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{
              background: sg("rgba(40,16,40,0.96)", "rgba(24,8,24,0.97)", "rgba(8,4,8,0.99)", 0.14),
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.4), 2px 2px 0 rgba(0,0,0,0.25)",
              color: "#F2E4CC", cursor: "pointer", outline: "none",
            }}>
            <ChevronLeft size={15} />
          </button>
          <p className="text-[9px] font-black uppercase tracking-[0.25em] text-[#180818]/50">
            {step === 1 ? "The Challenge" : step === 2 ? "The Rules" : step === 3 ? "The Stakes" : "Preview & Launch"}
          </p>
          <button onClick={close}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{
              background: sg("rgba(40,16,40,0.96)", "rgba(24,8,24,0.97)", "rgba(8,4,8,0.99)", 0.14),
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.4), 2px 2px 0 rgba(0,0,0,0.25)",
              color: "#F2E4CC", cursor: "pointer", outline: "none",
            }}>
            <X size={14} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 pb-8">

          {/* ── STEP 1 ── */}
          {step === 1 && (
            <div className="flex flex-col gap-5 pt-3">
              <div>
                <h2 className="text-[32px] font-black text-[#180818] leading-none tracking-tight">
                  Throw your<br />
                  <span style={{ color: "#E8506A", textShadow: "4px 4px 0 #7A1230" }}>Challenge.</span>
                </h2>
                <p className="text-[12px] text-[#180818]/40 mt-2">Be specific. Vague challenges get fewer accepts.</p>
              </div>
              <div className="relative">
                <textarea
                  ref={textRef}
                  value={challenge}
                  onChange={(e) => setChallenge(e.target.value)}
                  placeholder={"e.g. \"Do 50 pushups in a shopping mall without stopping\""}
                  rows={4}
                  maxLength={160}
                  className="w-full px-4 py-3.5 text-[15px] font-medium text-[#180818] placeholder-[#180818]/25 resize-none outline-none transition-all rounded-xl"
                  style={{
                    background: sg("rgba(255,255,255,0.5)", "rgba(255,255,255,0.92)", "rgba(248,242,232,0.95)", 0.55),
                    border: "2px solid rgba(255,255,255,0.88)",
                    boxShadow: "inset 0 3px 0 rgba(255,255,255,0.7), inset 0 -2px 0 rgba(200,160,100,0.2)",
                    caretColor: "#E8506A",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(232,80,106,0.8)", e.currentTarget.style.boxShadow = "inset 0 3px 0 rgba(255,255,255,0.6), 3px 3px 0 #7A1230")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.88)", e.currentTarget.style.boxShadow = "inset 0 3px 0 rgba(255,255,255,0.7), inset 0 -2px 0 rgba(200,160,100,0.2)")}
                />
                <span className={clsx("absolute bottom-3 right-3 text-[10px] tabular-nums font-mono", challenge.length > 130 ? "text-[#E8506A]" : "text-[#180818]/20")}>
                  {160 - challenge.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#180818]/30">Need inspiration?</p>
                <div className="flex flex-col gap-1.5">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} onClick={() => setChallenge(ex)}
                      className="text-left px-3 py-3 text-[12px] text-[#180818]/55 hover:text-[#180818]/80 transition-all btn-press rounded-xl"
                      style={{
                        background: sg("rgba(255,255,255,0.45)", "rgba(255,255,255,0.88)", "rgba(248,242,232,0.92)", 0.5),
                        border: "1px solid rgba(255,255,255,0.82)",
                        boxShadow: "inset 0 3px 0 rgba(255,255,255,0.65), 2px 2px 0 rgba(200,160,100,0.18)",
                        outline: "none", cursor: "pointer",
                      }}>
                      "{ex}"
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={next} disabled={!canStep1} className="rounded-2xl"
                style={canStep1 ? {
                  background: sg(STEP_META[0].top, STEP_META[0].mid, STEP_META[0].bot, STEP_META[0].hi),
                  border: `1px solid ${STEP_META[0].border}`,
                  boxShadow: `inset 0 3px 0 rgba(255,255,255,${STEP_META[0].hi + 0.06}), inset 0 -2px 0 rgba(122,18,48,0.5), 0 5px 0 #7A1230`,
                  transform: "translateY(-2px)", color: "#F2E4CC", width: "100%", padding: "16px",
                  fontWeight: 900, fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center",
                  gap: "8px", cursor: "pointer", outline: "none", textShadow: "0 1px 0 rgba(122,18,48,0.4)",
                } : {
                  background: "rgba(200,160,100,0.15)", color: "rgba(24,8,24,0.28)",
                  border: "1px solid rgba(200,160,100,0.2)", width: "100%", padding: "16px",
                  fontWeight: 900, fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center",
                  gap: "8px", cursor: "not-allowed", outline: "none", borderRadius: "16px",
                }}>
                Set the rules <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* ── STEP 2 ── */}
          {step === 2 && (
            <div className="flex flex-col gap-5 pt-3">
              <div>
                <h2 className="text-[32px] font-black text-[#180818] leading-none tracking-tight">
                  Set the<br />
                  <span style={{ color: "#1B8B82", textShadow: "4px 4px 0 #0C5E57" }}>rules.</span>
                </h2>
                <p className="text-[12px] text-[#180818]/40 mt-2">This determines how hard it is and what it's worth.</p>
              </div>
              {/* Category */}
              <div className="flex flex-col gap-2.5">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#180818]/35">Category</p>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map((c) => (
                    <button key={c.id} onClick={() => setCategory(c.id)}
                      className="flex items-center gap-3 px-4 py-3.5 transition-all btn-press rounded-xl"
                      style={category === c.id ? {
                        background: sg(c.top, c.mid, c.bot, c.hi),
                        border: `1px solid ${c.border}`,
                        boxShadow: `inset 0 3px 0 rgba(255,255,255,${c.hi + 0.06}), inset 0 -2px 0 rgba(0,0,0,0.25), 3px 4px 0 ${c.deep}`,
                        transform: "translateY(-2px)", cursor: "pointer", outline: "none",
                      } : {
                        background: sg("rgba(255,255,255,0.45)", "rgba(255,255,255,0.88)", "rgba(248,242,232,0.92)", 0.5),
                        border: "1px solid rgba(255,255,255,0.82)",
                        boxShadow: "inset 0 3px 0 rgba(255,255,255,0.65), 2px 2px 0 rgba(200,160,100,0.18)",
                        cursor: "pointer", outline: "none",
                      }}>
                      <span className="text-2xl">{c.emoji}</span>
                      <span className="text-[13px] font-black"
                        style={{ color: category === c.id ? c.fg : "#180818", textShadow: category === c.id ? "0 1px 0 rgba(0,0,0,0.3)" : "none" }}>
                        {c.label}
                      </span>
                      {category === c.id && <span className="ml-auto text-[10px] font-black" style={{ color: c.fg }}>✓</span>}
                    </button>
                  ))}
                </div>
              </div>
              {/* Difficulty */}
              <div className="flex flex-col gap-2.5">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#180818]/35">Difficulty</p>
                <div className="flex flex-col gap-2">
                  {DIFFICULTIES.map((d) => (
                    <button key={d.id} onClick={() => setDifficulty(d.id)}
                      className="flex items-center gap-4 px-4 py-3.5 transition-all btn-press rounded-xl"
                      style={difficulty === d.id ? {
                        background: sg(d.top, d.mid, d.bot, d.hi),
                        border: `1px solid ${d.border}`,
                        boxShadow: `inset 0 3px 0 rgba(255,255,255,${d.hi + 0.06}), inset 0 -2px 0 rgba(0,0,0,0.25), 3px 4px 0 ${d.deep}`,
                        transform: "translateY(-2px)", cursor: "pointer", outline: "none",
                      } : {
                        background: sg("rgba(255,255,255,0.45)", "rgba(255,255,255,0.88)", "rgba(248,242,232,0.92)", 0.5),
                        border: "1px solid rgba(255,255,255,0.82)",
                        boxShadow: "inset 0 3px 0 rgba(255,255,255,0.65), 2px 2px 0 rgba(200,160,100,0.18)",
                        cursor: "pointer", outline: "none",
                      }}>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] font-black"
                            style={{ color: difficulty === d.id ? d.fg : "#180818", textShadow: difficulty === d.id ? "0 1px 0 rgba(0,0,0,0.3)" : "none" }}>
                            {d.label}
                          </span>
                          <span className="text-[11px] font-black tabular-nums"
                            style={{ color: difficulty === d.id ? (d.fg === "#F2E4CC" ? "#F0C040" : "#E8506A") : "rgba(24,8,24,0.4)" }}>
                            +{d.rep} rep
                          </span>
                        </div>
                        <div className="h-1.5 rounded-xl overflow-hidden"
                          style={{ background: difficulty === d.id ? "rgba(0,0,0,0.2)" : "rgba(200,160,100,0.18)" }}>
                          <div className="h-full rounded-xl transition-all duration-500"
                            style={{ width: difficulty === d.id ? d.barW : "0%", background: "rgba(255,255,255,0.45)" }} />
                        </div>
                        <p className="text-[10px] mt-1"
                          style={{ color: difficulty === d.id ? (d.fg === "#F2E4CC" ? "rgba(250,235,213,0.6)" : "rgba(24,8,24,0.5)") : "rgba(24,8,24,0.3)" }}>
                          {d.desc}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Time limit */}
              <div className="flex flex-col gap-2.5">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#180818]/35">
                  <Clock size={9} className="inline mr-1" />Time limit
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {TIME_LIMITS.map((t) => (
                    <button key={t.id} onClick={() => setTimeLimit(t.id)}
                      className="py-3 text-[11px] font-bold text-center transition-all btn-press rounded-xl"
                      style={timeLimit === t.id ? {
                        background: sg(STEP_META[1].top, STEP_META[1].mid, STEP_META[1].bot, STEP_META[1].hi),
                        border: `1px solid ${STEP_META[1].border}`,
                        boxShadow: `inset 0 3px 0 rgba(255,255,255,${STEP_META[1].hi + 0.06}), inset 0 -2px 0 rgba(8,61,56,0.45), 2px 2px 0 ${STEP_META[1].deep}`,
                        color: "#F2E4CC", transform: "translateY(-1px)", cursor: "pointer", outline: "none",
                        textShadow: "0 1px 0 rgba(8,61,56,0.4)",
                      } : {
                        background: sg("rgba(255,255,255,0.45)", "rgba(255,255,255,0.88)", "rgba(248,242,232,0.92)", 0.5),
                        border: "1px solid rgba(255,255,255,0.82)",
                        boxShadow: "inset 0 3px 0 rgba(255,255,255,0.65), 1px 1px 0 rgba(200,160,100,0.15)",
                        color: "rgba(24,8,24,0.4)", cursor: "pointer", outline: "none",
                      }}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={next} disabled={!canStep2} className="rounded-2xl"
                style={canStep2 ? {
                  background: sg(STEP_META[1].top, STEP_META[1].mid, STEP_META[1].bot, STEP_META[1].hi),
                  border: `1px solid ${STEP_META[1].border}`,
                  boxShadow: `inset 0 3px 0 rgba(255,255,255,${STEP_META[1].hi + 0.06}), inset 0 -2px 0 rgba(8,61,56,0.5), 0 5px 0 #0C5E57`,
                  transform: "translateY(-2px)", color: "#F2E4CC", width: "100%", padding: "16px",
                  fontWeight: 900, fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center",
                  gap: "8px", cursor: "pointer", outline: "none", textShadow: "0 1px 0 rgba(8,61,56,0.4)",
                } : {
                  background: "rgba(200,160,100,0.15)", color: "rgba(24,8,24,0.28)",
                  border: "1px solid rgba(200,160,100,0.2)", width: "100%", padding: "16px",
                  fontWeight: 900, fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center",
                  gap: "8px", cursor: "not-allowed", outline: "none", borderRadius: "16px",
                }}>
                Set the stakes <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* ── STEP 3 ── */}
          {step === 3 && (
            <div className="flex flex-col gap-5 pt-3">
              <div>
                <h2 className="text-[32px] font-black text-[#180818] leading-none tracking-tight">
                  Raise the<br />
                  <span style={{ color: "#F0C040", textShadow: "4px 4px 0 #B88820" }}>stakes.</span>
                </h2>
                <p className="text-[12px] text-[#180818]/40 mt-2">Optional. A bounty makes people more likely to attempt your challenge.</p>
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#180818]/35">
                  <Trophy size={9} className="inline mr-1" />Add a bounty (optional)
                </p>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#180818]/25 text-sm font-black">+</div>
                  <input
                    type="number" value={bounty} onChange={(e) => setBounty(e.target.value)} placeholder="0"
                    className="w-full pl-8 pr-16 py-3.5 text-[22px] font-black text-[#180818] placeholder-[#180818]/15 outline-none transition-all tabular-nums rounded-xl"
                    style={{
                      background: sg("rgba(255,255,255,0.5)", "rgba(255,255,255,0.92)", "rgba(248,242,232,0.95)", 0.55),
                      border: "2px solid rgba(255,255,255,0.88)",
                      boxShadow: "inset 0 3px 0 rgba(255,255,255,0.7), inset 0 -2px 0 rgba(200,160,100,0.2)",
                      caretColor: "#F0C040",
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(240,192,64,0.9)", e.currentTarget.style.boxShadow = "inset 0 3px 0 rgba(255,255,255,0.6), 3px 3px 0 #B88820")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.88)", e.currentTarget.style.boxShadow = "inset 0 3px 0 rgba(255,255,255,0.7), inset 0 -2px 0 rgba(200,160,100,0.2)")}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-black text-[#180818]/30 uppercase tracking-wide">rep</span>
                </div>
              </div>
              <div className="flex gap-2">
                {["50", "100", "250", "500"].map((v) => (
                  <button key={v} onClick={() => setBounty(v)}
                    className="flex-1 py-3 text-[11px] font-black transition-all btn-press rounded-xl"
                    style={bounty === v ? {
                      background: sg(STEP_META[2].top, STEP_META[2].mid, STEP_META[2].bot, STEP_META[2].hi),
                      border: `1px solid ${STEP_META[2].border}`,
                      boxShadow: `inset 0 3px 0 rgba(255,255,255,${STEP_META[2].hi + 0.06}), inset 0 -2px 0 rgba(160,108,12,0.45), 2px 2px 0 #B88820`,
                      color: "#180818", transform: "translateY(-1px)", cursor: "pointer", outline: "none",
                    } : {
                      background: sg("rgba(255,255,255,0.45)", "rgba(255,255,255,0.88)", "rgba(248,242,232,0.92)", 0.5),
                      border: "1px solid rgba(255,255,255,0.82)",
                      boxShadow: "inset 0 3px 0 rgba(255,255,255,0.65), 1px 1px 0 rgba(200,160,100,0.15)",
                      color: "rgba(24,8,24,0.4)", cursor: "pointer", outline: "none",
                    }}>
                    +{v}
                  </button>
                ))}
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#180818]/35">Visibility</p>
                <div className="flex gap-2">
                  {[
                    { val: true, icon: <Eye size={13} />, label: "Public",    sm: STEP_META[1] },
                    { val: false, icon: <EyeOff size={13} />, label: "Crew only", sm: { top: "rgba(100,160,224,0.98)", mid: "rgba(74,130,192,0.97)", bot: "rgba(28,60,120,1.0)", border: "rgba(140,190,240,0.72)", deep: "#2E5580", hi: 0.44 } },
                  ].map((opt) => {
                    const active = isPublic === opt.val;
                    return (
                      <button key={String(opt.val)} onClick={() => setIsPublic(opt.val)}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-[12px] font-bold transition-all btn-press rounded-xl"
                        style={active ? {
                          background: sg(opt.sm.top, opt.sm.mid, opt.sm.bot, opt.sm.hi),
                          border: `1px solid ${opt.sm.border}`,
                          boxShadow: `inset 0 3px 0 rgba(255,255,255,${opt.sm.hi + 0.06}), inset 0 -2px 0 rgba(0,0,0,0.25), 3px 3px 0 ${opt.sm.deep}`,
                          color: "#F2E4CC", transform: "translateY(-2px)", cursor: "pointer", outline: "none",
                          textShadow: "0 1px 0 rgba(0,0,0,0.3)",
                        } : {
                          background: sg("rgba(255,255,255,0.45)", "rgba(255,255,255,0.88)", "rgba(248,242,232,0.92)", 0.5),
                          border: "1px solid rgba(255,255,255,0.82)",
                          boxShadow: "inset 0 3px 0 rgba(255,255,255,0.65), 1px 1px 0 rgba(200,160,100,0.15)",
                          color: "rgba(24,8,24,0.4)", cursor: "pointer", outline: "none",
                        }}>
                        {opt.icon} {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button onClick={next} className="w-full py-4 font-black text-[14px] text-[#180818] flex items-center justify-center gap-2 transition-all btn-press rounded-2xl"
                style={{
                  background: sg(STEP_META[2].top, STEP_META[2].mid, STEP_META[2].bot, STEP_META[2].hi),
                  border: `1px solid ${STEP_META[2].border}`,
                  boxShadow: `inset 0 3px 0 rgba(255,255,255,${STEP_META[2].hi + 0.06}), inset 0 -2px 0 rgba(160,108,12,0.45), 0 5px 0 #B88820`,
                  transform: "translateY(-2px)", cursor: "pointer", outline: "none",
                }}>
                Preview challenge <ChevronRight size={15} />
              </button>
              <button onClick={next} className="text-center text-[11px] text-[#180818]/25 hover:text-[#180818]/45 transition-colors -mt-2"
                style={{ background: "none", border: "none", cursor: "pointer", outline: "none" }}>
                Skip — no bounty
              </button>
            </div>
          )}

          {/* ── STEP 4 ── */}
          {step === 4 && (
            <div className="flex flex-col gap-5 pt-3">
              <div>
                <h2 className="text-[32px] font-black text-[#180818] leading-none tracking-tight">
                  Ready to<br />
                  <span style={{ color: "#E8506A", textShadow: "4px 4px 0 #7A1230" }}>launch.</span>
                </h2>
                <p className="text-[12px] text-[#180818]/40 mt-2">This is how your challenge will appear in the arena.</p>
              </div>
              {/* Preview card */}
              {selectedCat && (
                <div className="rounded-xl overflow-hidden"
                  style={{
                    background: sg(selectedCat.top, selectedCat.mid, selectedCat.bot, selectedCat.hi),
                    border: `1px solid ${selectedCat.border}`,
                    boxShadow: `inset 0 3px 0 rgba(255,255,255,${selectedCat.hi + 0.06}), inset 0 -2px 0 rgba(0,0,0,0.22), 4px 6px 0 ${selectedCat.deep}`,
                  }}>
                  <div className="h-28 flex items-center justify-center relative"
                    style={{ background: "linear-gradient(160deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.45) 100%)" }}>
                    <span className="text-5xl opacity-25">{selectedCat.emoji}</span>
                    {bounty && (
                      <div className="absolute top-3 right-3 px-2.5 py-1.5 rounded-xl"
                        style={{
                          background: sg(STEP_META[2].top, STEP_META[2].mid, STEP_META[2].bot, STEP_META[2].hi),
                          border: `1px solid ${STEP_META[2].border}`,
                          boxShadow: `inset 0 2px 0 rgba(255,255,255,0.55), 2px 2px 0 #B88820`,
                          color: "#180818",
                        }}>
                        <span className="text-[9px] font-black">+{bounty} bounty</span>
                      </div>
                    )}
                  </div>
                  <div className="p-4">
                    <p className="text-[14px] font-black text-[#F2E4CC] leading-snug mb-2"
                      style={{ textShadow: "0 1px 0 rgba(0,0,0,0.35)" }}>"{challenge}"</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {selectedDiff && <span className="text-[9px] font-black px-2.5 py-1 rounded-xl text-[#F2E4CC]"
                        style={{ background: "rgba(0,0,0,0.22)", borderRadius: "100px" }}>+{selectedDiff.rep} rep</span>}
                      {timeLimit && <span className="text-[9px] text-[#F2E4CC]/50 flex items-center gap-1">
                        <Clock size={8} />{TIME_LIMITS.find(t => t.id === timeLimit)?.label}</span>}
                    </div>
                  </div>
                </div>
              )}
              {/* Summary */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Category",   value: selectedCat?.label ?? "—" },
                  { label: "Difficulty", value: selectedDiff?.label ?? "—" },
                  { label: "Rep reward", value: selectedDiff ? `+${selectedDiff.rep}` : "—" },
                  { label: "Time limit", value: TIME_LIMITS.find(t => t.id === timeLimit)?.label ?? "—" },
                  { label: "Bounty",     value: bounty ? `+${bounty} rep` : "None" },
                  { label: "Visibility", value: isPublic ? "Public" : "Crew only" },
                ].map((s) => (
                  <div key={s.label} className="flex flex-col gap-0.5 px-3 py-2.5 rounded-xl"
                    style={{
                      background: sg("rgba(255,255,255,0.45)", "rgba(255,255,255,0.88)", "rgba(248,242,232,0.92)", 0.5),
                      border: "1px solid rgba(255,255,255,0.82)",
                      boxShadow: "inset 0 3px 0 rgba(255,255,255,0.65), 1px 1px 0 rgba(200,160,100,0.15)",
                    }}>
                    <span className="text-[9px] uppercase tracking-wide text-[#180818]/30">{s.label}</span>
                    <span className="text-[12px] font-black text-[#180818]/75">{s.value}</span>
                  </div>
                ))}
              </div>
              <button onClick={publish} disabled={publishing} className="rounded-2xl"
                style={publishing ? {
                  background: "rgba(200,160,100,0.15)", color: "rgba(24,8,24,0.28)",
                  width: "100%", padding: "16px", fontWeight: 900, fontSize: "15px",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                  outline: "none", border: "1px solid rgba(200,160,100,0.2)",
                } : {
                  background: sg(STEP_META[0].top, STEP_META[0].mid, STEP_META[0].bot, STEP_META[0].hi),
                  border: `1px solid ${STEP_META[0].border}`,
                  boxShadow: `inset 0 3px 0 rgba(255,255,255,${STEP_META[0].hi + 0.06}), inset 0 -2px 0 rgba(122,18,48,0.5), 0 6px 0 #7A1230, 0 8px 20px rgba(122,18,48,0.3)`,
                  transform: "translateY(-3px)", color: "#F2E4CC", width: "100%", padding: "16px",
                  fontWeight: 900, fontSize: "15px", display: "flex", alignItems: "center", justifyContent: "center",
                  gap: "8px", cursor: "pointer", outline: "none", transition: "all 0.08s",
                  textShadow: "0 1px 0 rgba(122,18,48,0.4)",
                }}>
                {publishing ? <>Publishing<span className="animate-pulse">…</span></> : <><Zap size={16} fill="currentColor" /> Launch challenge to arena</>}
              </button>
              <p className="text-center text-[10px] text-[#180818]/25 -mt-2">
                Challenge stays live for 24 hours · Anyone can accept it
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
