import { Redirect } from "expo-router";
import { useAuthStore } from "../src/store/authStore";

export default function Index() {
  const { token, isHydrated } = useAuthStore();
  if (!isHydrated) return null;
  return <Redirect href={token ? "/(tabs)/feed" : "/(auth)/phone"} />;
}
