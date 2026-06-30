import * as Notifications from "expo-notifications";
import { useEffect } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/authStore";

export function useNotifications() {
  const authToken = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!authToken) return;
    (async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") return;
      const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync();
      api.post("/api/users/me/fcm-token", { token: expoPushToken }).catch(() => {});
    })();
  }, [authToken]);
}
