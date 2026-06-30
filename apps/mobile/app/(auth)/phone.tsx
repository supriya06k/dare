import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { router } from "expo-router";
import auth from "@react-native-firebase/auth";
import { api } from "../../src/lib/api";
import { useAuthStore } from "../../src/store/authStore";
import { PressButton } from "../../src/components/ui/PressButton";
import { palette, spacing, font, radii } from "../../src/lib/tokens";

type Step = "phone" | "otp";

export default function PhoneScreen() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [confirm, setConfirm] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  const sendOtp = async () => {
    const normalized = phone.startsWith("+") ? phone : `+91${phone}`;
    setLoading(true);
    try {
      const confirmation = await auth().signInWithPhoneNumber(normalized);
      setConfirm(confirmation);
      setStep("otp");
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!confirm) return;
    setLoading(true);
    try {
      const result = await confirm.confirm(otp);
      const idToken = await result.user.getIdToken();

      const normalizedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
      const res = await api.post<{ token: string; userId: number; isNew: boolean }>(
        "/api/auth/otp/verify",
        { firebaseToken: idToken }
      );
      await setAuth(res.token, res.userId, normalizedPhone);
      router.replace("/(tabs)/feed");
    } catch (e: any) {
      Alert.alert("Invalid OTP", "Please check the code and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>dare</Text>
        <Text style={styles.tagline}>Complete dares. Earn real rewards.</Text>

        {step === "phone" ? (
          <>
            <Text style={styles.label}>Enter your phone number</Text>
            <View style={styles.inputRow}>
              <Text style={styles.flag}>🇮🇳 +91</Text>
              <TextInput
                style={styles.input}
                placeholder="98765 43210"
                placeholderTextColor={palette.textMuted}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
                maxLength={10}
                autoFocus
              />
            </View>
            <PressButton
              label="Send OTP"
              onPress={sendOtp}
              loading={loading}
              disabled={phone.length < 10}
            />
          </>
        ) : (
          <>
            <Text style={styles.label}>Enter the 6-digit code sent to {phone}</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="• • • • • •"
              placeholderTextColor={palette.textMuted}
              keyboardType="number-pad"
              value={otp}
              onChangeText={setOtp}
              maxLength={6}
              autoFocus
            />
            <PressButton
              label="Verify & continue"
              onPress={verifyOtp}
              loading={loading}
              disabled={otp.length < 6}
            />
            <PressButton label="Change number" onPress={() => setStep("phone")} variant="ghost" />
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.bg },
  inner: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "center",
    gap: spacing.lg,
  },
  logo: {
    fontSize: 48,
    fontWeight: "900",
    color: palette.accent,
    letterSpacing: -2,
    marginBottom: spacing.xs,
  },
  tagline: { fontSize: font.base, color: palette.textMuted, marginBottom: spacing.xl },
  label: { fontSize: font.sm, color: palette.textMuted, fontWeight: "600" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    backgroundColor: palette.surface,
  },
  flag: { fontSize: font.base, marginRight: spacing.sm, color: palette.text },
  input: {
    flex: 1,
    paddingVertical: spacing.md,
    color: palette.text,
    fontSize: font.lg,
    fontWeight: "700",
    letterSpacing: 1,
  },
  otpInput: {
    textAlign: "center",
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: radii.md,
    backgroundColor: palette.surface,
    paddingVertical: spacing.md,
    letterSpacing: 8,
  },
});
