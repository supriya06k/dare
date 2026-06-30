import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { useDares } from "../../src/api/hooks";
import { useMyDrops } from "../../src/api/hooks";
import { useDareStore } from "../../src/store/dareStore";
import { DareCard } from "../../src/components/ui/DareCard";
import { PostDareSheet } from "../../src/components/sheets/PostDareSheet";
import { palette, spacing, font } from "../../src/lib/tokens";
import type { Dare } from "../../src/api/types";

const CATEGORIES = ["All", "Fitness", "Comedy", "Food", "Skill", "Social", "Wild"];

export default function FeedScreen() {
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [showPost, setShowPost] = useState(false);

  const { data: dares = [], isLoading } = useDares(category ? { category } : undefined);
  const { data: drops = [] } = useMyDrops();
  const { setAcceptedIds, acceptedDareIds } = useDareStore();

  useEffect(() => {
    if (drops.length > 0) {
      const activeIds = drops
        .filter((d) => ["accepted", "voting", "pending"].includes(d.status))
        .map((d) => d.dareId);
      setAcceptedIds(activeIds);
    }
  }, [drops]);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>dare</Text>
        <Pressable style={styles.postBtn} onPress={() => setShowPost(true)}>
          <Text style={styles.postBtnText}>+ Post</Text>
        </Pressable>
      </View>

      {/* Category filter */}
      <FlashList
        data={CATEGORIES}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(c) => c}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.filterChip,
              (item === "All" ? !category : category === item) && styles.filterChipActive,
            ]}
            onPress={() => setCategory(item === "All" ? undefined : item)}
          >
            <Text
              style={[
                styles.filterText,
                (item === "All" ? !category : category === item) && styles.filterTextActive,
              ]}
            >
              {item}
            </Text>
          </Pressable>
        )}
      />

      <FlashList
        data={dares}
        keyExtractor={(d) => String(d.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }: { item: Dare }) => (
          <DareCard
            dare={item}
            alreadyAccepted={acceptedDareIds.has(item.id)}
            onPress={() => router.push(`/dare/${item.slug}`)}
          />
        )}
        ListEmptyComponent={
          isLoading ? null : (
            <Text style={styles.empty}>No dares yet. Be the first to post one!</Text>
          )
        }
      />

      {showPost && <PostDareSheet onClose={() => setShowPost(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingTop: 60,
    paddingBottom: spacing.md,
  },
  wordmark: { fontSize: 28, fontWeight: "900", color: palette.accent, letterSpacing: -1 },
  postBtn: {
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
  },
  postBtnText: { color: palette.bg, fontWeight: "700", fontSize: font.sm },
  filterList: { paddingHorizontal: spacing.xl, paddingBottom: spacing.md },
  filterChip: {
    borderWidth: 1,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    marginRight: spacing.sm,
  },
  filterChipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  filterText: { color: palette.textMuted, fontSize: font.xs, fontWeight: "600" },
  filterTextActive: { color: palette.bg },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
  empty: {
    color: palette.textMuted,
    textAlign: "center",
    marginTop: 60,
    fontSize: font.base,
  },
});
