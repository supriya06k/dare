import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import BottomSheet, {
  BottomSheetView,
  BottomSheetTextInput,
} from "@gorhom/bottom-sheet";
import {
  useProfile,
  useSeason,
  usePayouts,
  useKYCStatus,
  useRequestPayout,
} from "../../src/api/hooks";
import { PressButton } from "../../src/components/ui/PressButton";
import { palette, spacing, font, radii } from "../../src/lib/tokens";
import type { Payout } from "../../src/api/types";

type Provider = "stripe" | "razorpay";

const STATUS_COLOR: Record<Payout["status"], string> = {
  pending: palette.textMuted,
  processing: "#60a5fa",
  paid: palette.green,
  failed: palette.red,
};

export default function PayoutsScreen() {
  const { data: profile } = useProfile();
  const { data: season } = useSeason();
  const { data: payouts = [] } = usePayouts();
  const { data: kyc } = useKYCStatus();
  const [requestOpen, setRequestOpen] = useState(false);

  const estimatedUsd =
    profile && season
      ? Math.round((profile.poolSharePct / 100) * season.prizePoolCoins * 0.01 * 100) / 100
      : 0;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>Earnings</Text>

        {/* Contribution / estimate card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Your contribution score</Text>
          <Text style={styles.scoreNum}>{profile?.score ?? 0}</Text>
          <Text style={styles.poolShare}>
            {(profile?.poolSharePct ?? 0).toFixed(2)}% of season pool
          </Text>
          <View style={styles.divider} />
          <Text style={styles.cardLabel}>Estimated payout this season</Text>
          <Text style={styles.estimateNum}>~${estimatedUsd.toFixed(2)}</Text>
          {season ? (
            <Text style={styles.seasonHint}>
              Season {season.number} · ends in {season.daysLeft}d
            </Text>
          ) : null}
        </View>

        {/* KYC banner */}
        {kyc && !kyc.kycVerified && (
          <View style={styles.kycBanner}>
            <Text style={styles.kycEmoji}>⚠️</Text>
            <View style={styles.kycCopy}>
              <Text style={styles.kycTitle}>Verify your identity to cash out</Text>
              <Text style={styles.kycSub}>
                KYC required before your first payout.
              </Text>
            </View>
            <PressButton
              label="Start"
              onPress={() =>
                Alert.alert("KYC", "KYC flow will open the provider in-app.")
              }
              variant="ghost"
            />
          </View>
        )}

        <PressButton
          label="Request payout"
          onPress={() => setRequestOpen(true)}
          disabled={!kyc?.kycVerified || estimatedUsd <= 0}
        />

        {/* History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payout history</Text>
          {payouts.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No payouts yet.</Text>
            </View>
          ) : (
            payouts.map((p) => <PayoutRow key={p.id} payout={p} />)
          )}
        </View>
      </ScrollView>

      {requestOpen && (
        <RequestSheet
          maxUsd={estimatedUsd}
          onClose={() => setRequestOpen(false)}
        />
      )}
    </View>
  );
}

function PayoutRow({ payout }: { payout: Payout }) {
  const color = STATUS_COLOR[payout.status];
  const amountLabel =
    payout.amountInr != null
      ? `₹${payout.amountInr.toFixed(2)}`
      : payout.amountUsd != null
        ? `$${payout.amountUsd.toFixed(2)}`
        : "—";
  return (
    <View style={styles.payoutRow}>
      <View style={styles.payoutInfo}>
        <Text style={styles.payoutAmount}>{amountLabel}</Text>
        <Text style={styles.payoutMeta}>
          {payout.provider} · {new Date(payout.requestedAt).toLocaleDateString()}
        </Text>
      </View>
      <View style={[styles.statusPill, { backgroundColor: color + "22" }]}>
        <Text style={[styles.statusText, { color }]}>{payout.status}</Text>
      </View>
    </View>
  );
}

function RequestSheet({
  maxUsd,
  onClose,
}: {
  maxUsd: number;
  onClose: () => void;
}) {
  const sheetRef = useRef<BottomSheet>(null);
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState<Provider>("stripe");
  const { mutate: request, isPending } = useRequestPayout();

  const handleClose = useCallback(() => onClose(), [onClose]);

  const submit = () => {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      Alert.alert("Invalid amount", "Enter a number greater than 0.");
      return;
    }
    if (provider === "stripe" && value > maxUsd) {
      Alert.alert("Too much", `Max available is $${maxUsd.toFixed(2)}.`);
      return;
    }
    request(
      provider === "razorpay"
        ? { provider, amount_inr: value }
        : { provider, amount_usd: value },
      {
        onSuccess: () => sheetRef.current?.close(),
        onError: () =>
          Alert.alert("Failed", "Could not request payout. Try again."),
      }
    );
  };

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={["55%"]}
      enablePanDownToClose
      onClose={handleClose}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.sheetHandle}
    >
      <BottomSheetView style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>Request payout</Text>
        <Text style={styles.sheetSub}>
          {provider === "razorpay"
            ? "Enter amount in INR"
            : `Available: $${maxUsd.toFixed(2)}`}
        </Text>

        <Text style={styles.label}>
          Amount ({provider === "razorpay" ? "INR" : "USD"})
        </Text>
        <BottomSheetTextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor={palette.textMuted}
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />

        <Text style={styles.label}>Provider</Text>
        <View style={styles.providerRow}>
          <Pressable
            style={[
              styles.providerChip,
              provider === "stripe" && styles.providerChipActive,
            ]}
            onPress={() => setProvider("stripe")}
          >
            <Text
              style={[
                styles.providerText,
                provider === "stripe" && styles.providerTextActive,
              ]}
            >
              Stripe
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.providerChip,
              provider === "razorpay" && styles.providerChipActive,
            ]}
            onPress={() => setProvider("razorpay")}
          >
            <Text
              style={[
                styles.providerText,
                provider === "razorpay" && styles.providerTextActive,
              ]}
            >
              Razorpay
            </Text>
          </Pressable>
        </View>

        <PressButton
          label="Request payout"
          onPress={submit}
          loading={isPending}
          disabled={!amount}
          style={styles.submitBtn}
        />
      </BottomSheetView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  content: {
    paddingTop: 60,
    paddingHorizontal: spacing.xl,
    paddingBottom: 100,
    gap: spacing.lg,
  },
  heading: { fontSize: font.xxl, fontWeight: "800", color: palette.text },
  card: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  cardLabel: {
    fontSize: font.xs,
    color: palette.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  scoreNum: { fontSize: font.xxl, fontWeight: "800", color: palette.text },
  poolShare: { fontSize: font.sm, color: palette.textMuted },
  estimateNum: { fontSize: font.xxl, fontWeight: "800", color: palette.gold },
  seasonHint: { fontSize: font.xs, color: palette.textMuted },
  divider: {
    height: 1,
    backgroundColor: palette.border,
    marginVertical: spacing.md,
  },
  kycBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: "#7f1d1d33",
    borderColor: palette.red,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  kycEmoji: { fontSize: 24 },
  kycCopy: { flex: 1, gap: 2 },
  kycTitle: { color: palette.text, fontWeight: "700", fontSize: font.sm },
  kycSub: { color: palette.textMuted, fontSize: font.xs },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: font.lg, fontWeight: "700", color: palette.text },
  empty: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderStyle: "dashed",
    borderRadius: radii.md,
    padding: spacing.xl,
    alignItems: "center",
  },
  emptyText: { color: palette.textMuted, fontSize: font.sm },
  payoutRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: palette.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  payoutInfo: { flex: 1, gap: 2 },
  payoutAmount: { fontSize: font.md, fontWeight: "700", color: palette.text },
  payoutMeta: { fontSize: font.xs, color: palette.textMuted },
  statusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  statusText: { fontSize: font.xs, fontWeight: "700", textTransform: "uppercase" },

  // sheet
  sheetBg: { backgroundColor: "#1a1a1a" },
  sheetHandle: { backgroundColor: palette.border },
  sheetContent: { padding: spacing.xl, gap: spacing.md },
  sheetTitle: { fontSize: font.xl, fontWeight: "800", color: palette.text },
  sheetSub: { fontSize: font.sm, color: palette.textMuted },
  label: {
    fontSize: font.xs,
    color: palette.textMuted,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  input: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    padding: spacing.md,
    color: palette.text,
    fontSize: font.lg,
    fontWeight: "700",
  },
  providerRow: { flexDirection: "row", gap: spacing.sm },
  providerChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: palette.border,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    alignItems: "center",
  },
  providerChipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accent + "22",
  },
  providerText: { color: palette.textMuted, fontWeight: "700", fontSize: font.sm },
  providerTextActive: { color: palette.gold },
  submitBtn: { marginTop: spacing.sm },
});
