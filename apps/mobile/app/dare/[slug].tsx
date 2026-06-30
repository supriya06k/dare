import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useDare, useAcceptDare, useMyDrops } from "../../src/api/hooks";
import { useDareStore } from "../../src/store/dareStore";
import { VoteSheet } from "../../src/components/sheets/VoteSheet";
import { PressButton } from "../../src/components/ui/PressButton";
import { palette, spacing, font, radii } from "../../src/lib/tokens";
import type { Drop } from "../../src/api/types";
import { ApiError } from "../../src/lib/api";

const colorMap: Record<string, string> = {
  red: "#7f1d1d",
  blue: "#1e3a5f",
  green: "#14532d",
  purple: "#4c1d95",
  orange: "#7c2d12",
  pink: "#831843",
};

export default function DareDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: dare, isLoading } = useDare(slug);
  const { data: drops = [] } = useMyDrops();
  const { acceptedDareIds, markAccepted } = useDareStore();

  const { mutate: accept, isPending: accepting } = useAcceptDare();
  const [voteDrop, setVoteDrop] = useState<Drop | null>(null);

  if (isLoading || !dare) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  const accent = colorMap[dare.colorKey] ?? "#1e3a5f";
  const alreadyAccepted = acceptedDareIds.has(dare.id);
  const myDrop = drops.find(
    (d) => d.dareId === dare.id && ["accepted", "voting", "pending"].includes(d.status)
  );
  const verifiedPercent =
    dare.totalDrops > 0
      ? Math.round((dare.totalVerified / dare.totalDrops) * 100)
      : 0;

  const handleAccept = () => {
    accept(dare.id, {
      onSuccess: () => {
        markAccepted(dare.id);
      },
      onError: (e) => {
        const msg =
          e instanceof ApiError && e.status === 409
            ? "You've already accepted this dare."
            : "Something went wrong. Try again.";
        Alert.alert("Oops", msg);
      },
    });
  };

  return (
    <View style={styles.root}>
      {/* Header gradient bar */}
      <View style={[styles.heroBar, { backgroundColor: accent }]} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable style={styles.closeBtn} onPress={() => router.back()}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>

        <View style={styles.meta}>
          <Text style={styles.category}>{dare.category} · {dare.difficulty}</Text>
          {dare.isBrandDare && (
            <View style={styles.brandBadge}>
              <Text style={styles.brandText}>Brand dare</Text>
            </View>
          )}
        </View>

        <Text style={styles.title}>{dare.title}</Text>
        {dare.originatorHandle && (
          <Text style={styles.originator}>by @{dare.originatorHandle}</Text>
        )}
        {dare.description ? (
          <Text style={styles.description}>{dare.description}</Text>
        ) : null}

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatBox label="Attempts" value={String(dare.totalDrops)} />
          <StatBox label="Verified" value={`${dare.totalVerified} (${verifiedPercent}%)`} />
          <StatBox label="Rep reward" value={`+${dare.repReward}`} accent />
        </View>

        {/* Accept / already accepted */}
        {alreadyAccepted ? (
          <View style={styles.inPoolBox}>
            <Text style={styles.inPoolEmoji}>🎯</Text>
            <Text style={styles.inPoolText}>Already in your dare pool</Text>
            {myDrop && (
              <PressButton
                label="Vote on submissions"
                onPress={() => setVoteDrop(myDrop)}
                variant="ghost"
              />
            )}
          </View>
        ) : (
          <PressButton
            label="Accept this dare"
            onPress={handleAccept}
            loading={accepting}
            style={styles.acceptBtn}
          />
        )}

        {/* Leaderboard / recent drops */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent drops</Text>
          {drops
            .filter((d) => d.dareId === dare.id)
            .slice(0, 5)
            .map((d) => (
              <Pressable
                key={d.dropId}
                style={styles.dropRow}
                onPress={() => ["voting", "pending"].includes(d.status) ? setVoteDrop(d) : null}
              >
                <Text style={styles.dropStatus}>{d.status}</Text>
                {["voting", "pending"].includes(d.status) && (
                  <Text style={styles.voteHint}>Tap to vote →</Text>
                )}
              </Pressable>
            ))}
        </View>
      </ScrollView>

      {voteDrop && (
        <VoteSheet
          drop={voteDrop}
          onClose={() => setVoteDrop(null)}
          onVoted={() => setVoteDrop(null)}
        />
      )}
    </View>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, accent && { color: palette.accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  heroBar: { height: 4 },
  scroll: { padding: spacing.xl, paddingBottom: 100, gap: spacing.lg },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: palette.bg },
  loadingText: { color: palette.textMuted, fontSize: font.base },
  closeBtn: {
    alignSelf: "flex-end",
    padding: spacing.sm,
    backgroundColor: palette.surface,
    borderRadius: radii.full,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  closeBtnText: { color: palette.textMuted, fontSize: font.base },
  meta: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  category: { color: palette.textMuted, fontSize: font.xs, fontWeight: "600", textTransform: "uppercase" },
  brandBadge: {
    backgroundColor: palette.accent + "22",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  brandText: { color: palette.gold, fontSize: font.xs, fontWeight: "700" },
  title: { fontSize: font.xxl, fontWeight: "800", color: palette.text, lineHeight: 36 },
  originator: { fontSize: font.sm, color: palette.accent },
  description: { fontSize: font.base, color: palette.textMuted, lineHeight: 22 },
  statsGrid: { flexDirection: "row", gap: spacing.md },
  statBox: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statValue: { fontSize: font.lg, fontWeight: "800", color: palette.text },
  statLabel: { fontSize: font.xs, color: palette.textMuted, fontWeight: "600" },
  acceptBtn: {},
  inPoolBox: {
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: palette.accent + "11",
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.accent + "33",
    padding: spacing.xl,
  },
  inPoolEmoji: { fontSize: 36 },
  inPoolText: { color: palette.gold, fontWeight: "700", fontSize: font.base },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: font.lg, fontWeight: "700", color: palette.text },
  dropRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: palette.border,
  },
  dropStatus: { color: palette.textMuted, fontSize: font.sm, fontWeight: "600" },
  voteHint: { color: palette.accent, fontSize: font.xs },
});
