import { useEffect } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useDerivedValue,
  runOnJS,
} from "react-native-reanimated";

export function useCountdown(deadlineIso: string) {
  const remaining = useSharedValue(
    Math.max(0, new Date(deadlineIso).getTime() - Date.now())
  );

  useEffect(() => {
    const interval = setInterval(() => {
      const ms = Math.max(0, new Date(deadlineIso).getTime() - Date.now());
      remaining.value = withTiming(ms, { duration: 980 });
    }, 1000);
    return () => clearInterval(interval);
  }, [deadlineIso]);

  const minutes = useDerivedValue(() =>
    Math.floor(remaining.value / 60000)
  );
  const seconds = useDerivedValue(() =>
    Math.floor((remaining.value % 60000) / 1000)
  );

  const urgentStyle = useAnimatedStyle(() => ({
    color: remaining.value < 60000 ? "#ef4444" : "#f59e0b",
  }));

  return { minutes, seconds, urgentStyle };
}
