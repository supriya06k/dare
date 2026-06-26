"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import NavBar from "./components/NavBar";
import DareFeed from "./components/DareFeed";
import LiveArena from "./components/LiveArena";
import SeasonBoard from "./components/SeasonBoard";
import ProfileCard from "./components/ProfileCard";
import PostDareSheet from "./components/PostDareSheet";

export default function Home() {
  const [tab, setTab] = useState("feed");
  const [postOpen, setPostOpen] = useState(false);
  const [feedKey, setFeedKey] = useState(0);
  const mainRef = useRef<HTMLElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);

  /* Scroll → move the shine beam vertically across the arena wall */
  useEffect(() => {
    const el = mainRef.current;
    const bg = bgRef.current;
    if (!el || !bg) return;
    function onScroll() {
      const pct = el!.scrollTop / (el!.scrollHeight - el!.clientHeight || 1);
      // beam travels from -20% (above viewport) to 120% (below viewport)
      const y = -20 + pct * 140;
      bg!.style.setProperty("--shine-y", `${y}%`);
    }
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [tab]);

  const changeTab = useCallback((id: string) => {
    if (typeof document !== "undefined" && "startViewTransition" in document) {
      (document as any).startViewTransition(() => setTab(id));
    } else {
      setTab(id);
    }
    /* Reset scroll on tab change */
    setTimeout(() => mainRef.current?.scrollTo({ top: 0 }), 10);
  }, []);

  return (
    <div className="min-h-screen flex justify-center" style={{ background: "#6A0F28" }}>
      {/* Fixed arena wall behind everything */}
      <div ref={bgRef} className="arena-bg" />

      <div className="relative flex flex-col w-full" style={{ maxWidth: 430 }}>
        <NavBar active={tab} onChange={changeTab} onPost={() => setPostOpen(true)} />

        <main ref={mainRef} className="flex-1 overflow-y-auto pb-28" style={{ viewTransitionName: "tab-content" }}>
          {tab === "feed"  && <DareFeed refreshKey={feedKey} />}
          {tab === "live"  && <LiveArena />}
          {tab === "ranks" && <SeasonBoard />}
          {tab === "me"    && <div className="px-4 py-4"><ProfileCard /></div>}
        </main>

        {postOpen && <PostDareSheet onClose={() => setPostOpen(false)} onPosted={() => { setFeedKey((k) => k + 1); changeTab("feed"); }} />}
      </div>
    </div>
  );
}
