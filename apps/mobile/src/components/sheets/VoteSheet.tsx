import React, { useCallback, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { PressButton } from "../ui/PressButton";
import { palette, spacing, font, radii } from "../../lib/tokens";
import { useVote } from "../../api/hooks";
import type { Drop } from "../../api/types";

interface Props {
  drop: Drop;
  onClose: () => void;
  onVoted?: () => void;
}

export function VoteSheet({ drop, onClose, onVoted }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const { mutate: vote, isPending } = useVote();

  const handleVote = (v: "pass" | "fail") => {
    vote({ dropId: drop.dropId, verdict: v }, {
      onSuccess: () => {
        onVoted?.();
        sheetRef.current?.close();
      },
    });
  };

  const handleClose = useCallback(() => onClose(), [onClose]);

  const total = drop.passVotes + drop.failVotes;
  const passRatio = total > 0 ? drop.passVotes / total : 0;

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
        <Text style={styles.sub} numberOfLines={2}>{drop.title}</Text>

        <View style={styles.bar}>
          <View style={[styles.barFill, { flex: passRatio }]} />
          <View style={[styles.barFail, { flex: 1 - passRatio }]} />
        </View>
        <View style={styles.counts}>
          <Text style={styles.passCount}>{drop.passVotes} pass</Text>
          <Text style={styles.failCount}>{drop.failVotes} fail</Text>
        </View>

        <View style={styles.buttons}>
          <PressButton
            label="PASS ✓"
            onPress={() => handleVote("pass")}
            loading={isPending}
            style={styles.passBtn}
          />
          <PressButton
            label="FAIL ✗"
            onPress={() => handleVote("fail")}
            loading={isPending}
            variant="danger"
            style={styles.failBtn}
          />
        </View>

        <Text style={styles.earn}>+$0.003 per vote · live dares earn +$0.006</Text>
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
