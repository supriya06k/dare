import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useLiveSessions, useLiveVote } from "../../src/api/hooks";
import { useWebSocket } from "../../src/hooks/useWebSocket";
import { VoteSheet } from "../../src/components/sheets/VoteSheet";
import { palette, spacing, font, radii } from "../../src/lib/tokens";
import type { LiveSession, VoteUpdate } from "../../src/api/types";

interface LiveCardProps {
  session: LiveSession;
  onVote: () => void;
}

function LiveCard({ session, onVote }: LiveCardProps) {
  const total = session.passVotes + session.failVotes;
  const passRatio = total > 0 ? session.passVotes / total : 0.5;

  return (
    <Pressable style={styles.card} onPress={onVote}>
      <View style={styles.livePill}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE</Text>
        <Text style={styles.viewers}> · {session.viewers} watching</Text>
      </View>

      <Text style={styles.dareTitle} numberOfLines={2}>{session.challenge}</Text>
      <Text style={styles.playerMeta}>
        {session.name} · {session.city} · #{session.seasonRank}
      </Text>

      <View style={styles.voteBar}>
        <View style={[styles.passFill, { flex: passRatio }]} />
        <View style={[styles.failFill, { flex: 1 - passRatio }]} />
      </View>

      <View style={styles.counts}>
        <Text style={styles.passCount}>{session.passVotes} pass</Text>
        <Text style={styles.earnBadge}>+3 Coins per vote</Text>
        <Text style={styles.failCount}>{session.failVotes} fail</Text>
      </View>
    </Pressable>
  );
}

function LiveCardConnected({
  session,
  onVote,
}: {
  session: LiveSession;
  onVote: (s: LiveSession) => void;
}) {
  const [votes, setVotes] = useState({ passVotes: session.passVotes, failVotes: session.failVotes });

  useWebSocket(session.id, (type, payload) => {
    if (type === "vote_update") {
      const p = payload as VoteUpdate;
      setVotes({ passVotes: p.passVotes, failVotes: p.failVotes });
    }
  });

  const enriched: LiveSession = { ...session, ...votes };
  return <LiveCard session={enriched} onVote={() => onVote(enriched)} />;
}

export default function LiveScreen() {
  const { data: sessions = [], isLoading } = useLiveSessions();
  const [activeSession, setActiveSession] = useState<LiveSession | null>(null);
  const { mutate: liveVote, isPending } = useLiveVote();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.heading}>Live arena</Text>
        <View style={styles.earnBanner}>
          <Text style={styles.earnBannerText}>Live votes earn Coins</Text>
        </View>
      </View>

      <FlashList
        data={sessions}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <LiveCardConnected session={item} onVote={setActiveSession} />
        )}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📡</Text>
              <Text style={styles.emptyText}>No live dares right now</Text>
              <Text style={styles.emptySub}>Check back soon — dares go live as people accept them.</Text>
            </View>
          )
        }
      />

      {activeSession && (
        <VoteSheet
          title={activeSession.challenge}
          passVotes={activeSession.passVotes}
          failVotes={activeSession.failVotes}
          pending={isPending}
          earnLabel="+3 Coins per live vote"
          onVote={(v) =>
            liveVote(
              { id: activeSession.id, verdict: v },
              { onSuccess: () => setActiveSession(null) }
            )
          }
          onClose={() => setActiveSession(null)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  header: {
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  heading: { fontSize: font.xxl, fontWeight: "800", color: palette.text },
  earnBanner: {
    backgroundColor: "#7f1d1d",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    alignSelf: "flex-start",
  },
  earnBannerText: { color: "#fca5a5", fontSize: font.xs, fontWeight: "700" },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  livePill: { flexDirection: "row", alignItems: "center" },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.red,
    marginRight: 6,
  },
  liveText: { color: palette.red, fontWeight: "800", fontSize: font.xs, letterSpacing: 1 },
  viewers: { color: palette.textMuted, fontSize: font.xs },
  dareTitle: { fontSize: font.lg, fontWeight: "700", color: palette.text },
  playerMeta: { fontSize: font.xs, color: palette.textMuted, fontWeight: "600" },
  voteBar: {
    height: 8,
    borderRadius: radii.full,
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: palette.border,
  },
  passFill: { backgroundColor: palette.green },
  failFill: { backgroundColor: palette.red },
  counts: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  passCount: { color: palette.green, fontWeight: "700", fontSize: font.sm },
  failCount: { color: palette.red, fontWeight: "700", fontSize: font.sm },
  earnBadge: {
    backgroundColor: "#d97706" + "33",
    color: palette.gold,
    fontSize: font.xs,
    fontWeight: "700",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  empty: { alignItems: "center", marginTop: 80, gap: spacing.md },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: font.lg, fontWeight: "700", color: palette.text },
  emptySub: { fontSize: font.sm, color: palette.textMuted, textAlign: "center" },
});
