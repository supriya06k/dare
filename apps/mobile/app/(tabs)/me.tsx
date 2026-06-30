import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { useProfile, useMyDrops } from "../../src/api/hooks";
import { useAuthStore } from "../../src/store/authStore";
import { SubmitSheet } from "../../src/components/sheets/SubmitSheet";
import { CountdownText } from "../../src/components/ui/CountdownText";
import { palette, spacing, font, radii } from "../../src/lib/tokens";
import type { Drop } from "../../src/api/types";

const STATUS_LABEL: Record<string, string> = {
  accepted: "Not submitted",
  pending: "Under AI review",
  voting: "Crowd voting",
  verified: "Verified ✓",
  ai_rejected: "AI rejected",
  crowd_rejected: "Crowd rejected",
  forfeited: "Forfeited",
};

const STATUS_COLOR: Record<string, string> = {
  accepted: palette.textMuted,
  pending: "#a78bfa",
  voting: "#60a5fa",
  verified: palette.green,
  ai_rejected: palette.red,
  crowd_rejected: palette.red,
  forfeited: palette.textMuted,
};

export default function MeScreen() {
  const { data: profile } = useProfile();
  const { data: drops = [] } = useMyDrops();
  const { logout } = useAuthStore();
  const [submitting, setSubmitting] = useState<Drop | null>(null);

  const activeDrops = drops.filter((d) =>
    ["accepted", "pending", "voting"].includes(d.status)
  );
  const pastDrops = drops.filter((d) =>
    ["verified", "ai_rejected", "crowd_rejected", "forfeited"].includes(d.status)
  );

  if (!profile) return null;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(profile.handle || profile.phone)[0].toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.handle}>{profile.handle || profile.phone}</Text>
          <Text style={styles.rep}>{profile.rep} rep · City rank #{profile.cityRank ?? "—"}</Text>
        </View>
        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>
      </View>

      {/* Stats row */}
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{profile.completions}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{profile.streak}</Text>
          <Text style={styles.statLabel}>Streak 🔥</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{profile.votesGiven}</Text>
          <Text style={styles.statLabel}>Votes cast</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{profile.score}</Text>
          <Text style={styles.statLabel}>Score</Text>
        </View>
      </View>

      {/* Badges */}
      {profile.badges.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Badges</Text>
          <View style={styles.badges}>
            {profile.badges.map((b) => (
              <View key={b.label} style={styles.badge}>
                <Text style={styles.badgeEmoji}>{b.icon}</Text>
                <Text style={styles.badgeName}>{b.label}</Text>
                {b.hint ? (
                  <Text style={styles.badgeHint}>{b.hint}</Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Dare pool — active */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Dare pool ({activeDrops.length})</Text>
        {activeDrops.length === 0 ? (
          <Pressable style={styles.emptyPool} onPress={() => router.push("/(tabs)/feed")}>
            <Text style={styles.emptyPoolText}>Accept dares from the feed to see them here</Text>
          </Pressable>
        ) : (
          activeDrops.map((drop) => (
            <DropRow key={drop.dropId} drop={drop} onSubmit={() => setSubmitting(drop)} />
          ))
        )}
      </View>

      {/* Past drops */}
      {pastDrops.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>History</Text>
          {pastDrops.map((drop) => (
            <DropRow key={drop.dropId} drop={drop} />
          ))}
        </View>
      )}

      {submitting && (
        <SubmitSheet
          drop={submitting}
          onClose={() => setSubmitting(null)}
          onSubmitted={() => setSubmitting(null)}
        />
      )}
    </ScrollView>
  );
}

function DropRow({ drop, onSubmit }: { drop: Drop; onSubmit?: () => void }) {
  const canSubmit = drop.status === "accepted";
  const color = STATUS_COLOR[drop.status] ?? palette.textMuted;

  return (
    <View style={styles.dropRow}>
      <View style={styles.dropInfo}>
        <Pressable onPress={() => router.push(`/dare/${drop.slug}`)}>
          <Text style={styles.dropTitle} numberOfLines={1}>{drop.title}</Text>
        </Pressable>
        <Text style={[styles.dropStatus, { color }]}>{STATUS_LABEL[drop.status] ?? drop.status}</Text>
        {canSubmit && drop.deadlineAt && (
          <View style={styles.countdown}>
            <Text style={styles.countdownPrefix}>Expires in </Text>
            <CountdownText deadlineIso={drop.deadlineAt} />
          </View>
        )}
      </View>
      {canSubmit && onSubmit && (
        <Pressable style={styles.submitBtn} onPress={onSubmit}>
          <Text style={styles.submitBtnText}>Submit</Text>
        </Pressable>
      )}
      {drop.status === "voting" && (
        <View style={styles.votingPill}>
          <Text style={styles.votingPillText}>{drop.passVotes}P / {drop.failVotes}F</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  content: { paddingTop: 60, paddingHorizontal: spacing.xl, paddingBottom: 100, gap: spacing.xl },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: palette.accent + "44",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: palette.accent, fontSize: font.xl, fontWeight: "800" },
  profileInfo: { flex: 1 },
  handle: { fontSize: font.lg, fontWeight: "700", color: palette.text },
  rep: { fontSize: font.sm, color: palette.textMuted },
  logoutBtn: { padding: spacing.sm },
  logoutText: { color: palette.textMuted, fontSize: font.sm },
  stats: {
    flexDirection: "row",
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    justifyContent: "space-around",
  },
  stat: { alignItems: "center", gap: spacing.xs },
  statNum: { fontSize: font.xl, fontWeight: "800", color: palette.text },
  statLabel: { fontSize: font.xs, color: palette.textMuted, fontWeight: "600" },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: font.lg, fontWeight: "700", color: palette.text },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  badge: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.accent + "55",
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
    minWidth: 90,
    gap: spacing.xs,
  },
  badgeLocked: { opacity: 0.4, borderColor: palette.border },
  badgeEmoji: { fontSize: 28 },
  badgeName: { fontSize: font.xs, fontWeight: "700", color: palette.text, textAlign: "center" },
  badgeHint: { fontSize: font.xs, color: palette.textMuted, textAlign: "center" },
  emptyPool: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: "dashed",
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyPoolText: { color: palette.textMuted, fontSize: font.sm, textAlign: "center" },
  dropRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  dropInfo: { flex: 1, gap: 4 },
  dropTitle: { fontSize: font.base, fontWeight: "700", color: palette.text },
  dropStatus: { fontSize: font.xs, fontWeight: "600" },
  countdown: { flexDirection: "row", alignItems: "center" },
  countdownPrefix: { fontSize: font.xs, color: palette.textMuted },
  submitBtn: {
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  submitBtnText: { color: palette.bg, fontWeight: "700", fontSize: font.xs },
  votingPill: {
    backgroundColor: "#60a5fa" + "33",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  votingPillText: { color: "#60a5fa", fontSize: font.xs, fontWeight: "700" },
});
