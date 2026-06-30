import React from "react";
import Animated from "react-native-reanimated";
import { StyleSheet } from "react-native";
import { useCountdown } from "../../hooks/useCountdown";
import { font } from "../../lib/tokens";

interface Props {
  deadlineIso: string;
}

export function CountdownText({ deadlineIso }: Props) {
  const { minutes, seconds, urgentStyle } = useCountdown(deadlineIso);

  return (
    <Animated.Text style={[styles.text, urgentStyle]}>
      {minutes.value}:{String(seconds.value).padStart(2, "0")}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: font.base,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
