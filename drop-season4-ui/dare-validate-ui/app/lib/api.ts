"use client";

// Single source of truth for talking to the DareApi (.NET) backend.
// Defaults to the local dev server; override with NEXT_PUBLIC_API_BASE.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5099";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}`);
  return (await res.json()) as T;
}

// ── Shared response shapes ────────────────────────────────────────────────────
export type FeedCard = {
  id: number;
  playerNo: string;
  title: string;
  user: string;
  city: string;
  votes: number;
  pts: number;
  duration: string;
  views: string;
  verified: boolean;
  trending: boolean;
  category: string;
  glTop: string;
  glMid: string;
  glBot: string;
  border: string;
  hi: number;
  deep: string;
  poolContrib: number;
  tall: boolean;
};

export type VoteResult = {
  dropId: number;
  verdict: "pass" | "fail";
  alreadyVoted: boolean;
  votes: number;
  earned: number;
  myEarnings: number;
  myVotes: number;
  prizePool: number;
};

export type Season = {
  number: number;
  daysLeft: number;
  prizePool: number;
  splits: { voters: number; creators: number; platform: number };
};

export type LeaderboardRow = {
  rank: number;
  playerNo: string;
  initials: string;
  name: string;
  city: string;
  challenges: number;
  points: number;
  earnings: number;
  votes: number;
  isMe: boolean;
};

export type Me = {
  username: string;
  city: string;
  rep: number;
  streak: number;
  cityRank: number;
  playerNo: string;
  completedTasks: number;
  badges: { label: string; icon: string }[];
  earnings: {
    total: number;
    challengesCreated: number;
    votesCast: number;
    watchCredit: number;
    votesGiven: number;
    challengesVerifiedByMe: number;
    creatorsHelped: number;
    payoutIn: number;
  };
  poolShare: number;
};

export type LivePerformerDto = {
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
  glTop: string;
  glMid: string;
  glBot: string;
  border: string;
  deep: string;
  hi: number;
};

export type CreatedDare = FeedCard;
