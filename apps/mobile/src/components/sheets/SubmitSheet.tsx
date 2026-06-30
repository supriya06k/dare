import React, { useRef, useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system";
import { PressButton } from "../ui/PressButton";
import { CountdownText } from "../ui/CountdownText";
import { palette, spacing, font, radii } from "../../lib/tokens";
import { useGetUploadUrl, useSubmitProof } from "../../api/hooks";
import type { Drop } from "../../api/types";

interface Props {
  drop: Drop;
  onClose: () => void;
  onSubmitted?: () => void;
}

type Stage = "preview" | "recording" | "uploading" | "done";

export function SubmitSheet({ drop, onClose, onSubmitted }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [stage, setStage] = useState<Stage>("preview");
  const [videoUri, setVideoUri] = useState<string | null>(null);

  const { mutateAsync: getUploadUrl } = useGetUploadUrl();
  const { mutateAsync: submitProof } = useSubmitProof();

  const startRecording = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setStage("recording");
    const video = await cameraRef.current?.recordAsync({ maxDuration: 60 });
    if (video?.uri) setVideoUri(video.uri);
    setStage("preview");
  };

  const stopRecording = () => {
    cameraRef.current?.stopRecording();
  };

  const handleUpload = async () => {
    if (!videoUri) return;
    setStage("uploading");
    try {
      const { uploadUrl, r2Key } = await getUploadUrl(drop.dropId);

      const fileInfo = await FileSystem.getInfoAsync(videoUri);
      if (!fileInfo.exists) throw new Error("video file missing");

      await FileSystem.uploadAsync(uploadUrl, videoUri, {
        httpMethod: "PUT",
        headers: { "Content-Type": "video/mp4" },
      });

      await submitProof({ dropId: drop.dropId, r2Key });
      setStage("done");
      onSubmitted?.();
    } catch (e) {
      setStage("preview");
      Alert.alert("Upload failed", "Please try again.");
    }
  };

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={["70%"]}
      enablePanDownToClose
      onClose={onClose}
      backgroundStyle={styles.bg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{drop.title}</Text>
          <View style={styles.countdown}>
            <Text style={styles.countdownLabel}>Time left </Text>
            <CountdownText deadlineIso={drop.deadlineAt ?? ""} />
          </View>
        </View>

        {stage === "done" ? (
          <View style={styles.doneBox}>
            <Text style={styles.doneEmoji}>🎯</Text>
            <Text style={styles.doneText}>Submitted for review!</Text>
            <Text style={styles.doneSub}>AI will screen it, then the crowd votes.</Text>
          </View>
        ) : (
          <>
            <View style={styles.cameraBox}>
              {permission?.granted ? (
                <CameraView
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  mode="video"
                  facing="back"
                />
              ) : (
                <View style={styles.permissionBox}>
                  <Text style={styles.permText}>Camera permission required</Text>
                  <PressButton label="Grant access" onPress={requestPermission} />
                </View>
              )}
              {videoUri && stage === "preview" && (
                <View style={styles.previewOverlay}>
                  <Text style={styles.previewLabel}>Video ready</Text>
                </View>
              )}
            </View>

            <View style={styles.actions}>
              {stage === "recording" ? (
                <PressButton label="Stop recording" onPress={stopRecording} variant="danger" />
              ) : videoUri ? (
                <>
                  <PressButton label="Re-record" onPress={() => setVideoUri(null)} variant="ghost" style={styles.halfBtn} />
                  <PressButton label="Submit" onPress={handleUpload} loading={stage === "uploading"} style={styles.halfBtn} />
                </>
              ) : (
                <PressButton label="Start recording" onPress={startRecording} />
              )}
            </View>
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  bg: { backgroundColor: "#1a1a1a" },
  handle: { backgroundColor: palette.border },
  content: { padding: spacing.xl, gap: spacing.lg, flex: 1 },
  header: { gap: spacing.xs },
  title: { fontSize: font.lg, fontWeight: "700", color: palette.text },
  countdown: { flexDirection: "row", alignItems: "center" },
  countdownLabel: { color: palette.textMuted, fontSize: font.sm },
  cameraBox: {
    flex: 1,
    borderRadius: radii.lg,
    overflow: "hidden",
    backgroundColor: palette.border,
    minHeight: 200,
  },
  permissionBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  permText: { color: palette.textMuted, fontSize: font.sm },
  previewOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#00000088",
    alignItems: "center",
    justifyContent: "center",
  },
  previewLabel: { color: palette.text, fontWeight: "700", fontSize: font.lg },
  actions: { flexDirection: "row", gap: spacing.md },
  halfBtn: { flex: 1 },
  doneBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  doneEmoji: { fontSize: 56 },
  doneText: { fontSize: font.xl, fontWeight: "800", color: palette.text },
  doneSub: { color: palette.textMuted, fontSize: font.base, textAlign: "center" },
});
