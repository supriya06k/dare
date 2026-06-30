import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { palette, radii, spacing, font } from "../../lib/tokens";
import type { Dare } from "../../api/types";

const colorMap: Record<string, string> = {
  red: "#7f1d1d",
  blue: "#1e3a5f",
  green: "#14532d",
  purple: "#4c1d95",
  orange: "#7c2d12",
  pink: "#831843",
};

interface Props {
  dare: Dare;
  onPress: () => void;
  alreadyAccepted?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function DareCard({ dare, onPress, alreadyAccepted = false }: Props) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const accent = colorMap[dare.colorKey] ?? "#1e3a5f";
  const difficultyLabel = dare.difficulty.charAt(0).toUpperCase() + dare.difficulty.slice(1);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.97, { damping: 20, stiffness: 400 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 20, stiffness: 400 }); }}
      style={[styles.card, { borderColor: accent + "66" }, animStyle]}
    >
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <View style={styles.body}>
        <View style={styles.row}>
          <Text style={styles.category}>{dare.category}</Text>
          {alreadyAccepted && (
            <View style={styles.inPoolBadge}>
              <Text style={styles.inPoolText}>In pool</Text>
            </View>
          )}
        </View>
        <Text style={styles.title} numberOfLines={2}>{dare.title}</Text>
        {dare.description ? (
          <Text style={styles.desc} numberOfLines={2}>{dare.description}</Text>
        ) : null}
        <View style={styles.footer}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{difficultyLabel}</Text>
          </View>
          <Text style={styles.reward}>+{dare.repReward} rep</Text>
          <Text style={styles.drops}>{dare.totalDrops} attempts</Text>
        </View>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: spacing.md,
    flexDirection: "row",
  },
  accentBar: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  category: {
    fontSize: font.xs,
    color: palette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "600",
  },
  inPoolBadge: {
    backgroundColor: palette.accent + "33",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  inPoolText: {
    color: palette.gold,
    fontSize: font.xs,
    fontWeight: "700",
  },
  title: {
    fontSize: font.md,
    fontWeight: "700",
    color: palette.text,
  },
  desc: {
    fontSize: font.sm,
    color: palette.textMuted,
    lineHeight: 18,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  pill: {
    backgroundColor: palette.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  pillText: {
    color: palette.textMuted,
    fontSize: font.xs,
    fontWeight: "600",
  },
  reward: {
    fontSize: font.sm,
    color: palette.accent,
    fontWeight: "700",
    marginLeft: "auto",
  },
  drops: {
    fontSize: font.xs,
    color: palette.textMuted,
  },
});
