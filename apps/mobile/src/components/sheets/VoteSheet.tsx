import React, { useCallback, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { PressButton } from "../ui/PressButton";
import { palette, spacing, font, radii } from "../../lib/tokens";

interface Props {
  title: string;
  passVotes: number;
  failVotes: number;
  onVote: (verdict: "pass" | "fail") => void;
  pending?: boolean;
  earnLabel?: string;
  onClose: () => void;
}

export function VoteSheet({ title, passVotes, failVotes, onVote, pending, earnLabel, onClose }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const handleClose = useCallback(() => onClose(), [onClose]);

  const total = passVotes + failVotes;
  const passRatio = total > 0 ? passVotes / total : 0;

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={["45%"]}
      enablePanDownToClose
      onClose={handleClose}
      backgroundStyle={styles.bg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title}>Cast your vote</Text>
        <Text style={styles.sub} numberOfLines={2}>{title}</Text>

        <View style={styles.bar}>
          <View style={[styles.barFill, { flex: passRatio }]} />
          <View style={[styles.barFail, { flex: 1 - passRatio }]} />
        </View>
        <View style={styles.counts}>
          <Text style={styles.passCount}>{passVotes} pass</Text>
          <Text style={styles.failCount}>{failVotes} fail</Text>
        </View>

        <View style={styles.buttons}>
          <PressButton
            label="PASS ✓"
            onPress={() => onVote("pass")}
            loading={pending}
            style={styles.passBtn}
          />
          <PressButton
            label="FAIL ✗"
            onPress={() => onVote("fail")}
            loading={pending}
            variant="danger"
            style={styles.failBtn}
          />
        </View>

        <Text style={styles.earn}>{earnLabel ?? "+3 Coins per vote"}</Text>
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: "#1a1a1a" },
  handle: { backgroundColor: palette.border },
  content: { padding: spacing.xl, gap: spacing.lg },
  title: { fontSize: font.xl, fontWeight: "800", color: palette.text },
  sub: { fontSize: font.sm, color: palette.textMuted },
  bar: {
    height: 8,
    borderRadius: radii.full,
    flexDirection: "row",
    overflow: "hidden",
    backgroundColor: palette.border,
  },
  barFill: { backgroundColor: palette.green },
  barFail: { backgroundColor: palette.red },
  counts: { flexDirection: "row", justifyContent: "space-between" },
  passCount: { color: palette.green, fontWeight: "700", fontSize: font.sm },
  failCount: { color: palette.red, fontWeight: "700", fontSize: font.sm },
  buttons: { flexDirection: "row", gap: spacing.md },
  passBtn: { flex: 1 },
  failBtn: { flex: 1 },
  earn: { textAlign: "center", color: palette.textMuted, fontSize: font.xs },
});
