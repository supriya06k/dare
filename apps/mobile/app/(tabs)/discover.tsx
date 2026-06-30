import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TextInput } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { useDares } from "../../src/api/hooks";
import { useMyDrops } from "../../src/api/hooks";
import { useDareStore } from "../../src/store/dareStore";
import { DareCard } from "../../src/components/ui/DareCard";
import { palette, spacing, font, radii } from "../../src/lib/tokens";
import type { Dare } from "../../src/api/types";

export default function DiscoverScreen() {
  const [search, setSearch] = useState("");
  const { data: dares = [] } = useDares();
  const { data: drops = [] } = useMyDrops();
  const { setAcceptedIds, acceptedDareIds } = useDareStore();

  useEffect(() => {
    if (drops.length > 0) {
      const ids = drops
        .filter((d) => ["accepted", "voting", "pending"].includes(d.status))
        .map((d) => d.dareId);
      setAcceptedIds(ids);
    }
  }, [drops]);

  const filtered = search.length > 1
    ? dares.filter(
        (d) =>
          d.title.toLowerCase().includes(search.toLowerCase()) ||
          d.category.toLowerCase().includes(search.toLowerCase())
      )
    : dares;

  return (
    <View style={styles.root}>
      <View style={styles.headerArea}>
        <Text style={styles.heading}>Discover dares</Text>
        <TextInput
          style={styles.search}
          placeholder="Search by name or category…"
          placeholderTextColor={palette.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlashList
        data={filtered}
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
          <Text style={styles.empty}>No dares match "{search}"</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  headerArea: {
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  heading: { fontSize: font.xxl, fontWeight: "800", color: palette.text },
  search: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: palette.text,
    fontSize: font.base,
  },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
  empty: {
    color: palette.textMuted,
    textAlign: "center",
    marginTop: 60,
    fontSize: font.base,
  },
});
