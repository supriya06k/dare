// Mirrors Go API JSON shapes (camelCase). Keep in sync with apps/api/internal/*/handler.go.

export interface Dare {
  id: number;
  slug: string;
  title: string;
  category: string;
  difficulty: "easy" | "medium" | "hard" | "extreme";
  repReward: number;
  isBrandDare: boolean;
  originatorId: number | null;
  originatorHandle: string | null;
  totalDrops: number;
  totalVerified: number;
  expiresInSeconds: number;
  colorKey: string;
  // Optional fields the Go handler doesn't return but are used by some UI placeholders.
  description?: string;
}

export interface Drop {
  dropId: number;
  dareId: number;
  slug: string;
  title: string;
  category: string;
  difficulty: string;
  repReward: number;
  status:
    | "accepted"
    | "pending"
    | "voting"
    | "verified"
    | "ai_rejected"
    | "crowd_rejected"
    | "rejected"
    | "forfeited";
  proofUrl: string | null;
  aiConfidence: number | null;
  passVotes: number;
  failVotes: number;
  deadlineAt: string | null;
  secondsLeft: number;
  createdAt: string;
  colorKey: string;
}

export interface UserProfile {
  id: number;
  handle: string;
  phone: string;
  city: string;
  playerNo: string;
  rep: number;
  streak: number;
  cityRank: number;
  completions: number;
  forfeits: number;
  votesGiven: number;
  score: number;
  poolSharePct: number;
  badges: Badge[];
}

export interface Badge {
  label: string;
  icon: string;
  hint: string;
}

export interface Season {
  id: number;
  number: number;
  prizePoolCoins: number;
  endsAt: string;
  daysLeft: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: number;
  handle: string;
  city: string;
  score: number;
  rep: number;
}

export interface LiveSession {
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
  colorKey: string;
}

export interface AcceptResponse {
  dropId: number;
  status: string;
  deadlineAt: string;
  secondsLeft: number;
}

export interface UploadUrlResponse {
  uploadUrl: string;
  r2Key: string;
  expiresIn: number;
}

export interface VoteUpdate {
  passVotes: number;
  failVotes: number;
  total: number;
}

export interface DropStatusUpdate {
  dropId: number;
  status: string;
}

export interface DuplicateCheckResponse {
  duplicate: boolean;
  dareId?: number;
  slug?: string;
  title?: string;
}

// ─── Payouts ─────────────────────────────────────────────────────────────────

export interface Payout {
  id: number;
  amountUsd: number | null;
  amountInr: number | null;
  provider: "stripe" | "razorpay";
  providerRef?: string;
  status: "pending" | "processing" | "paid" | "failed";
  requestedAt: string;
  paidAt: string | null;
}

export interface KYCStatus {
  kycVerified: boolean;
}
