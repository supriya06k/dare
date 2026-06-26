"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

export default function AcceptDareModal({
  dare,
  category,
  rep,
  onClose,
}: {
  dare: string;
  category: string;
  rep: number;
  onClose: () => void;
}) {
  const [secondsLeft, setSecondsLeft] = useState(1200);

  useEffect(() => {
    const iv = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const minutes = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center sheet-enter"
      style={{
        background: "rgba(0,0,0,0.95)",
        boxShadow: "inset 0 0 120px rgba(255,61,110,0.08)",
      }}
    >
      {/* Red vignette at edges */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(255,20,60,0.12) 100%)",
        }}
      />

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 w-full max-w-sm">
        {/* Label */}
        <span
          className="text-[11px] font-black tracking-[0.25em] uppercase"
          style={{ color: "var(--accent)" }}
        >
          Challenge Accepted
        </span>

        {/* Dare text box */}
        <div
          className="w-full rounded-2xl px-5 py-4 text-center"
          style={{
            border: "1px solid rgba(255,61,110,0.35)",
            background: "rgba(255,61,110,0.06)",
          }}
        >
          <p className="text-xl font-black text-white leading-snug">{dare}</p>
        </div>

        {/* Countdown */}
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] text-white/30 uppercase tracking-widest">You have</span>
          <span
            className={clsx(
              "text-6xl font-black tabular-nums font-mono leading-none",
              secondsLeft < 60 ? "text-[var(--accent)]" : "text-white"
            )}
          >
            {timeStr}
          </span>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-3">
          <span
            className="text-[11px] font-bold px-3 py-1 rounded-full"
            style={{
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.3)",
              color: "#a78bfa",
            }}
          >
            {category}
          </span>
          <span
            className="text-[11px] font-bold px-3 py-1 rounded-full"
            style={{
              background: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.25)",
              color: "#34d399",
            }}
          >
            +{rep} rep
          </span>
        </div>

        {/* Start recording CTA */}
        <button
          className="w-full py-4 rounded-2xl font-black text-base text-white btn-press"
          style={{
            background: "linear-gradient(135deg, #ff3d6e 0%, #c026d3 100%)",
            boxShadow:
              "0 0 40px rgba(255,61,110,0.45), 0 4px 16px rgba(255,61,110,0.25)",
          }}
        >
          START RECORDING
        </button>

        {/* Back out */}
        <button
          onClick={onClose}
          className="text-[12px] text-white/25 text-center leading-relaxed"
        >
          Back out
          <br />
          <span className="text-[10px] text-white/15">
            Note: forfeit is recorded on your profile
          </span>
        </button>
      </div>
    </div>
  );
}
