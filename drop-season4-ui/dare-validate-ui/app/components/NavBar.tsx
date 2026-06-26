"use client";

import { Home, PlayCircle, Plus, BarChart2, User } from "lucide-react";

const TABS = [
  { id: "feed",  label: "Feed",  icon: Home },
  { id: "live",  label: "Live",  icon: PlayCircle },
  { id: "ranks", label: "Ranks", icon: BarChart2 },
  { id: "me",    label: "Me",    icon: User },
];

/* Solid glass wall-color header — like a slab of pink crystal */
const HEADER_BG = `
  radial-gradient(ellipse 100% 60% at 50% 0%, rgba(255,255,255,0.22) 0%, transparent 55%),
  linear-gradient(180deg,
    rgba(200,60,90,0.98) 0%,
    rgba(160,28,60,0.98) 55%,
    rgba(122,18,48,0.99) 100%
  )
`.trim();

const HEADER_SHADOW = [
  "inset 0 3px 0 rgba(255,255,255,0.42)",
  "inset 0 -2px 0 rgba(80,8,28,0.55)",
  "0 4px 0 #7A1230",
  "0 8px 28px rgba(24,8,24,0.45)",
].join(", ");

const NAV_BG = `
  radial-gradient(ellipse 100% 80% at 50% 100%, rgba(255,255,255,0.1) 0%, transparent 60%),
  linear-gradient(0deg,
    rgba(122,18,48,0.99) 0%,
    rgba(160,28,60,0.98) 60%,
    rgba(180,44,72,0.96) 100%
  )
`.trim();

export default function NavBar({
  active,
  onChange,
  onPost,
}: {
  active: string;
  onChange: (id: string) => void;
  onPost: () => void;
}) {
  return (
    <>
      {/* Solid glass header slab */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-5 py-3"
        style={{
          background: HEADER_BG,
          borderBottom: "1px solid rgba(255,155,175,0.35)",
          boxShadow: HEADER_SHADOW,
        }}>

        <div className="flex items-baseline gap-2">
          <span className="font-black leading-none tracking-tight text-[#F2E4CC]"
            style={{
              fontSize: "34px",
              letterSpacing: "-0.04em",
              textShadow: "0 2px 0 rgba(80,8,28,0.45), 0 -1px 0 rgba(255,255,255,0.25)",
            }}>
            DROP
          </span>
          <span className="text-[8px] font-black tracking-[0.6em] uppercase text-[#F2E4CC]/35 pb-1">S4</span>
        </div>

        {/* Live pill — solid crimson glass */}
        <div className="flex items-center gap-2 px-4 py-2"
          style={{
            background: [
              "radial-gradient(ellipse 90% 55% at 50% 0%, rgba(255,255,255,0.32) 0%, transparent 60%)",
              "linear-gradient(170deg, rgba(220,48,48,0.98) 0%, rgba(180,24,24,0.98) 50%, rgba(120,8,8,0.99) 100%)",
            ].join(", "),
            borderRadius: "100px",
            border: "1px solid rgba(255,130,130,0.55)",
            boxShadow: [
              "inset 0 3px 0 rgba(255,255,255,0.38)",
              "inset 0 -2px 0 rgba(80,0,0,0.5)",
              "0 4px 0 #7A0000",
              "0 0 16px rgba(200,32,32,0.4)",
            ].join(", "),
          }}>
          <span className="relative flex h-2 w-2">
            <span className="live-dot relative inline-flex rounded-full h-2 w-2 bg-[#F2E4CC]"
              style={{ color: "#F2E4CC" }} />
          </span>
          <span className="text-[11px] font-black tracking-[0.12em] text-[#F2E4CC]"
            style={{ textShadow: "0 1px 0 rgba(80,0,0,0.4)" }}>
            4,821 LIVE
          </span>
        </div>
      </header>

      {/* Solid glass floor nav */}
      <nav className="sticky bottom-0 z-50 flex items-stretch"
        style={{
          background: NAV_BG,
          borderTop: "1px solid rgba(255,155,175,0.3)",
          boxShadow: [
            "inset 0 3px 0 rgba(255,255,255,0.18)",
            "inset 0 -1px 0 rgba(80,8,28,0.4)",
            "0 -4px 0 #7A1230",
            "0 -8px 24px rgba(24,8,24,0.4)",
          ].join(", "),
        }}>
        <div className="flex items-center w-full px-1">
          {TABS.slice(0, 2).map((tab) => <NavBtn key={tab.id} tab={tab} active={active} onChange={onChange} />)}

          {/* FAB — solid teal glass gem */}
          <div className="flex-1 flex justify-center items-center">
            <button onClick={onPost}
              className="flex items-center justify-center -mt-8"
              style={{
                width: 56,
                height: 56,
                borderRadius: "18px",
                background: [
                  "radial-gradient(ellipse 90% 55% at 50% 0%, rgba(255,255,255,0.42) 0%, transparent 62%)",
                  "linear-gradient(170deg, rgba(53,189,179,0.99) 0%, rgba(27,139,130,0.98) 45%, rgba(8,61,56,1.0) 100%)",
                ].join(", "),
                border: "1px solid rgba(100,230,220,0.72)",
                boxShadow: [
                  "inset 0 3px 0 rgba(255,255,255,0.52)",
                  "inset 0 -2px 0 rgba(8,61,56,0.6)",
                  "0 8px 0 #0C5E57",
                  "0 0 24px rgba(27,139,130,0.45)",
                ].join(", "),
                transform: "translateY(-4px)",
                transition: "transform 0.08s ease, box-shadow 0.08s ease",
                cursor: "pointer",
                outline: "none",
              }}
              onMouseDown={(e) => {
                const b = e.currentTarget;
                b.style.transform = "translateY(4px)";
                b.style.boxShadow = "inset 0 3px 0 rgba(8,61,56,0.45), 0 2px 0 #0C5E57";
              }}
              onMouseUp={(e) => {
                const b = e.currentTarget;
                b.style.transform = "translateY(-4px)";
                b.style.boxShadow = [
                  "inset 0 3px 0 rgba(255,255,255,0.52)",
                  "inset 0 -2px 0 rgba(8,61,56,0.6)",
                  "0 8px 0 #0C5E57",
                  "0 0 24px rgba(27,139,130,0.45)",
                ].join(", ");
              }}>
              <Plus size={26} color="#F2E4CC" strokeWidth={3}
                style={{ filter: "drop-shadow(0 1px 0 rgba(8,61,56,0.45))" }} />
            </button>
          </div>

          {TABS.slice(2).map((tab) => <NavBtn key={tab.id} tab={tab} active={active} onChange={onChange} />)}
        </div>
      </nav>
    </>
  );
}

function NavBtn({ tab, active, onChange }: { tab: typeof TABS[0]; active: string; onChange: (id: string) => void }) {
  const Icon = tab.icon;
  const isActive = active === tab.id;
  return (
    <button onClick={() => onChange(tab.id)}
      className="flex-1 flex flex-col items-center gap-1 py-3 relative"
      style={{ border: "none", outline: "none", background: "transparent", cursor: "pointer" }}>
      {isActive && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] w-10"
          style={{
            background: "linear-gradient(90deg, rgba(240,192,64,0.6), #F0C040, rgba(240,192,64,0.6))",
            borderRadius: "3px 3px 0 0",
            boxShadow: "0 0 10px rgba(240,192,64,0.8), 0 -1px 0 rgba(255,255,255,0.3)",
          }} />
      )}
      <Icon size={20} strokeWidth={isActive ? 2.5 : 1.5}
        style={{
          color: isActive ? "#F0C040" : "rgba(242,228,204,0.38)",
          filter: isActive ? "drop-shadow(0 1px 0 rgba(184,136,32,0.5)) drop-shadow(0 0 6px rgba(240,192,64,0.4))" : "none",
        }} />
      <span className="text-[9px] font-black uppercase tracking-[0.1em]"
        style={{
          color: isActive ? "#F0C040" : "rgba(242,228,204,0.38)",
          textShadow: isActive ? "0 1px 0 rgba(184,136,32,0.5), 0 0 8px rgba(240,192,64,0.5)" : "none",
        }}>
        {tab.label}
      </span>
    </button>
  );
}
