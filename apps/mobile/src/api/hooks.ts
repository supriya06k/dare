import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import type {
  Dare,
  Drop,
  UserProfile,
  Season,
  LeaderboardEntry,
  LiveSession,
  AcceptResponse,
  UploadUrlResponse,
  DuplicateCheckResponse,
  Payout,
  KYCStatus,
} from "./types";

// ─── Dares ───────────────────────────────────────────────────────────────────

export function useDares(params?: { category?: string }) {
  const qs = params?.category ? `?category=${params.category}` : "";
  return useQuery<Dare[]>({
    queryKey: ["dares", params],
    queryFn: () => api.get(`/api/dares${qs}`),
  });
}

export function useDare(slug: string) {
  return useQuery<Dare>({
    queryKey: ["dare", slug],
    queryFn: () => api.get(`/api/dares/slug/${slug}`),
    enabled: !!slug,
  });
}

export function useCreateDare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Dare>) => api.post<Dare>("/api/dares", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dares"] }),
  });
}

export function useCheckDuplicate() {
  return useMutation({
    mutationFn: (title: string) =>
      api.post<DuplicateCheckResponse>("/api/dares/check", { title }),
  });
}

export function useAcceptDare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dareId: number) =>
      api.post<AcceptResponse>(`/api/dares/${dareId}/accept`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drops", "mine"] }),
  });
}

// ─── Drops ────────────────────────────────────────────────────────────────────

export function useMyDrops() {
  return useQuery<Drop[]>({
    queryKey: ["drops", "mine"],
    queryFn: () => api.get("/api/drops/mine"),
  });
}

export function useGetUploadUrl() {
  return useMutation({
    mutationFn: (dropId: number) =>
      api.post<UploadUrlResponse>(`/api/drops/${dropId}/proof/upload-url`),
  });
}

export function useSubmitProof() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dropId, r2Key }: { dropId: number; r2Key: string }) =>
      api.post(`/api/drops/${dropId}/proof`, { r2Key }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["drops", "mine"] }),
  });
}

export function useVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dropId, verdict }: { dropId: number; verdict: "pass" | "fail" }) =>
      api.post(`/api/drops/${dropId}/vote`, { verdict }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drops"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function useProfile() {
  return useQuery<UserProfile>({
    queryKey: ["profile"],
    queryFn: () => api.get("/api/users/me"),
  });
}

// ─── Seasons ──────────────────────────────────────────────────────────────────

export function useSeason() {
  return useQuery<Season>({
    queryKey: ["season"],
    queryFn: () => api.get("/api/seasons/current"),
  });
}

export function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard"],
    queryFn: () => api.get("/api/seasons/current/leaderboard"),
  });
}

// ─── Live ─────────────────────────────────────────────────────────────────────

export function useLiveSessions() {
  return useQuery<LiveSession[]>({
    queryKey: ["live"],
    queryFn: () => api.get("/api/live"),
    refetchInterval: 15_000,
  });
}

// ─── Payouts ─────────────────────────────────────────────────────────────────

export function usePayouts() {
  return useQuery<Payout[]>({
    queryKey: ["payouts"],
    queryFn: () => api.get("/api/payouts"),
  });
}

export function useRequestPayout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { provider: "stripe" | "razorpay"; amount_usd?: number; amount_inr?: number }) =>
      api.post<Payout>("/api/payouts/request", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payouts"] }),
  });
}

export function useKYCStatus() {
  return useQuery<KYCStatus>({
    queryKey: ["kyc"],
    queryFn: () => api.get("/api/payouts/kyc-status"),
  });
}

export function useCompleteKYC() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { provider: string; details: Record<string, string> }) =>
      api.post<KYCStatus>("/api/payouts/kyc-complete", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kyc"] }),
  });
}
