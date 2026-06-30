import React, { useCallback, useRef, useState } from "react";
import { View, Text, TextInput, StyleSheet } from "react-native";
import BottomSheet, { BottomSheetView, BottomSheetTextInput } from "@gorhom/bottom-sheet";
import { PressButton } from "../ui/PressButton";
import { palette, spacing, font, radii } from "../../lib/tokens";
import { useCreateDare, useCheckDuplicate } from "../../api/hooks";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORIES = ["Fitness", "Comedy", "Food", "Skill", "Social", "Wild"];
const DIFFICULTIES = ["easy", "medium", "hard", "extreme"] as const;

interface Props {
  onClose: () => void;
}

export function PostDareSheet({ onClose }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const qc = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Fitness");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard" | "extreme">("medium");
  const [dupWarning, setDupWarning] = useState("");

  const { mutate: create, isPending } = useCreateDare();
  const { mutate: checkDup } = useCheckDuplicate();

  const handleBlurTitle = () => {
    if (title.length < 5) return;
    checkDup(title, {
      onSuccess: (r) => {
        if (r.duplicate) {
          setDupWarning(`Similar dare exists: "${r.title ?? ""}"`);
        } else {
          setDupWarning("");
        }
      },
    });
  };

  const handleSubmit = () => {
    if (!title.trim()) return;
    create(
      { title, description, category, difficulty },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: ["dares"] });
          sheetRef.current?.close();
        },
      }
    );
  };

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={["80%"]}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.bg}
      handleIndicatorStyle={styles.handle}
      keyboardBehavior="extend"
    >
      <BottomSheetView style={styles.content}>
        <Text style={styles.title}>Post a dare</Text>

        <BottomSheetTextInput
          style={styles.input}
          placeholder="Dare title (e.g. 100 push-ups in 2 minutes)"
          placeholderTextColor={palette.textMuted}
          value={title}
          onChangeText={setTitle}
          onBlur={handleBlurTitle}
        />
        {dupWarning ? <Text style={styles.warn}>{dupWarning}</Text> : null}

        <BottomSheetTextInput
          style={[styles.input, styles.textarea]}
          placeholder="Description"
          placeholderTextColor={palette.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <PressButton
              key={c}
              label={c}
              variant={category === c ? "primary" : "ghost"}
              onPress={() => setCategory(c)}
              style={styles.chip}
            />
          ))}
        </View>

        <Text style={styles.label}>Difficulty</Text>
        <View style={styles.chips}>
          {DIFFICULTIES.map((d) => (
            <PressButton
              key={d}
              label={d}
              variant={difficulty === d ? "primary" : "ghost"}
              onPress={() => setDifficulty(d)}
              style={styles.chip}
            />
          ))}
        </View>

        <PressButton
          label="Post dare"
          onPress={handleSubmit}
          loading={isPending}
          disabled={!title.trim()}
          style={styles.submit}
        />
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: "#1a1a1a" },
  handle: { backgroundColor: palette.border },
  content: { padding: spacing.xl, gap: spacing.md },
  title: { fontSize: font.xl, fontWeight: "800", color: palette.text },
  input: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    padding: spacing.md,
    color: palette.text,
    fontSize: font.base,
  },
  textarea: { minHeight: 72, textAlignVertical: "top" },
  warn: { color: palette.red, fontSize: font.xs },
  label: { color: palette.textMuted, fontSize: font.xs, fontWeight: "600", textTransform: "uppercase" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, minHeight: 36 },
  submit: { marginTop: spacing.sm },
});
