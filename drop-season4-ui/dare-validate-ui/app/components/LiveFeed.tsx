"use client";

import { useEffect, useState } from "react";
import { MapPin, CheckCircle, XCircle, Flame } from "lucide-react";
import clsx from "clsx";

type FeedItem = {
  id: number;
  user: string;
  task: string;
  city: string;
  status: "verified" | "rejected" | "voting";
  votes: number;
  timeAgo: string;
  category: "physical" | "creative" | "speed" | "social";
};

const SEED_FEED: FeedItem[] = [
  { id: 1, user: "maria_r",  task: "Held a plank for 3 minutes in Times Square",   city: "New York",  status: "verified", votes: 847,  timeAgo: "12s ago", category: "physical" },
  { id: 2, user: "devraj_k", task: "Drew a portrait of a stranger in 5 minutes",    city: "Mumbai",    status: "voting",   votes: 312,  timeAgo: "just now", category: "creative" },
  { id: 3, user: "leo_chen", task: "Ordered food in a language I don't speak",      city: "Tokyo",     status: "voting",   votes: 129,  timeAgo: "34s ago", category: "social" },
  { id: 4, user: "amara_b",  task: "Ran 1km in under 4 minutes",                   city: "Lagos",     status: "verified", votes: 1204, timeAgo: "1m ago",  category: "physical" },
  { id: 5, user: "soph_w",   task: "Improvised a 60-second speech to strangers",   city: "London",    status: "rejected", votes: 88,   timeAgo: "2m ago",  category: "social" },
  { id: 6, user: "kim_j",    task: "Assembled IKEA chair blindfolded in 8min",      city: "Seoul",     status: "verified", votes: 2109, timeAgo: "3m ago",  category: "speed" },
];

const NEW_ITEMS: FeedItem[] = [
  { id: 7, user: "priya_s",  task: "Balanced 5 books on head for 60 seconds",       city: "Bangalore", status: "voting",   votes: 0, timeAgo: "just now", category: "physical" },
  { id: 8, user: "tomas_v",  task: "Cold-pitched a stranger on a business idea",    city: "Berlin",    status: "voting",   votes: 0, timeAgo: "just now", category: "social" },
  { id: 9, user: "alex_m",   task: "Solved 10 mental math problems in 30 seconds",  city: "Sydney",    status: "voting",   votes: 0, timeAgo: "just now", category: "speed" },
];

const CAT = {
  physical: { label: "Physical", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
  creative: { label: "Creative", color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
  speed:    { label: "Speed",    color: "text-cyan-400",   bg: "bg-cyan-400/10   border-cyan-400/20" },
  social:   { label: "Social",   color: "text-pink-400",   bg: "bg-pink-400/10   border-pink-400/20" },
};

export default function LiveFeed() {
  const [items, setItems] = useState<FeedItem[]>(SEED_FEED);
  const [newCount, setNewCount] = useState(0);

  useEffect(() => {
    let idx = 0;
    let uid = 100;
    const iv = setInterval(() => {
      if (idx < NEW_ITEMS.length) {
        const id = uid++;
        setItems((prev) => [{ ...NEW_ITEMS[idx], id, timeAgo: "just now" }, ...prev.slice(0, 11)]);
        setNewCount((c) => c + 1);
        idx++;
      }
    }, 4000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setItems((prev) => prev.map((item) =>
        item.status === "voting"
          ? { ...item, votes: item.votes + Math.floor(Math.random() * 12) }
          : item
      ));
    }, 1200);
    return () => clearInterval(iv);
  }, []);

  return (
    <section className="flex flex-col gap-3 px-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="live-dot relative inline-flex rounded-full h-2.5 w-2.5 bg-[var(--accent)]" />
          </span>
          <span className="text-sm font-black tracking-wider uppercase text-[var(--accent)]">Live Feed</span>
        </div>
        <span className="text-[11px] text-white/30 font-mono">
          {newCount > 0 && <span className="text-[var(--accent)] font-bold">+{newCount} new · </span>}
          {items.length} active
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2">
        {items.map((item, i) => {
          const cat = CAT[item.category];
          const isNew = i === 0 && newCount > 0;
          return (
            <div
              key={item.id}
              className={clsx(
                "rounded-2xl p-4 transition-all duration-500 border",
                isNew
                  ? "animate-slide-up"
                  : "",
                item.status === "voting"
                  ? "border-cyan-500/15"
                  : item.status === "verified"
                  ? "border-emerald-500/10"
                  : "border-white/5"
              )}
              style={{
                background: isNew
                  ? "linear-gradient(135deg, rgba(255,61,110,0.06), rgba(12,12,28,1))"
                  : "rgba(255,255,255,0.025)",
              }}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0"
                  style={{
                    background: `hsl(${((item.user ?? "a").charCodeAt(0) * 37) % 360}, 60%, 35%)`,
                  }}
                >
                  {(item.user ?? "?")[0].toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-bold text-sm text-white">@{item.user}</span>
                    <span className={clsx("text-[10px] font-bold px-1.5 py-0.5 rounded-full border", cat.color, cat.bg)}>
                      {cat.label}
                    </span>
                    <span className="text-[10px] text-white/25 flex items-center gap-0.5">
                      <MapPin size={8} />{item.city}
                    </span>
                  </div>
                  <p className="text-[13px] text-white/65 leading-snug">{item.task}</p>

                  {/* Bottom row */}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] text-white/20">{item.timeAgo}</span>
                    <StatusBadge status={item.status} votes={item.votes} />
                  </div>
                </div>
              </div>

              {/* Live vote bar for voting items */}
              {item.status === "voting" && (
                <div className="mt-3 flex flex-col gap-1">
                  <div className="h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min((item.votes / 500) * 100, 100)}%`,
                        background: "linear-gradient(90deg, #06b6d4, #7c3aed)",
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatusBadge({ status, votes }: { status: FeedItem["status"]; votes: number }) {
  if (status === "verified") return (
    <div className="flex items-center gap-1 text-emerald-400">
      <CheckCircle size={12} />
      <span className="text-[11px] font-black">{votes.toLocaleString()}</span>
    </div>
  );
  if (status === "rejected") return (
    <div className="flex items-center gap-1 text-red-400">
      <XCircle size={12} />
      <span className="text-[11px] font-bold">AI won</span>
    </div>
  );
  return (
    <div className="flex items-center gap-1 text-cyan-400">
      <Flame size={12} className="animate-pulse" />
      <span className="text-[11px] font-black">{votes} voting</span>
    </div>
  );
}
