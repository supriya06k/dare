import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import * as SecureStore from "expo-secure-store";
import * as Notifications from "expo-notifications";
import { useAuthStore } from "../src/store/authStore";
import { useNotifications } from "../src/hooks/useNotifications";
import { palette } from "../src/lib/tokens";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function NotificationRegistrar() {
  useNotifications();
  return null;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { hydrate, isHydrated } = useAuthStore();

  useEffect(() => {
    SecureStore.getItemAsync("auth_token").then((t) => hydrate(t));
  }, []);

  if (!isHydrated) return null;
  return (
    <>
      <NotificationRegistrar />
      {children}
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette.bg }}>
      <QueryClientProvider client={queryClient}>
        <AuthGate>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: palette.bg },
              animation: "slide_from_right",
            }}
          >
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="dare/[slug]"
              options={{ presentation: "modal", animation: "slide_from_bottom" }}
            />
          </Stack>
        </AuthGate>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
