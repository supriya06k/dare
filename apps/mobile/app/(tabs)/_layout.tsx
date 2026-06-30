import React from "react";
import { Tabs, Redirect } from "expo-router";
import { View, StyleSheet } from "react-native";
import { useAuthStore } from "../../src/store/authStore";
import { palette, font } from "../../src/lib/tokens";

function TabIcon({ focused, emoji }: { focused: boolean; emoji: string }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconActive]}>
      <View style={styles.emojiWrap}>
        {/* Rendered as text in tab bar via tabBarLabel */}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { token } = useAuthStore();
  if (!token) return <Redirect href="/(auth)/phone" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.bar,
        tabBarActiveTintColor: palette.accent,
        tabBarInactiveTintColor: palette.textMuted,
        tabBarLabelStyle: styles.label,
      }}
    >
      <Tabs.Screen
        name="feed"
        options={{ title: "Feed", tabBarIcon: ({ focused }) => null }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: "Discover", tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="live"
        options={{ title: "Live", tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="payouts"
        options={{ title: "Earn", tabBarIcon: () => null }}
      />
      <Tabs.Screen
        name="me"
        options={{ title: "Me", tabBarIcon: () => null }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#111",
    borderTopColor: palette.border,
    borderTopWidth: 1,
    height: 72,
    paddingBottom: 12,
  },
  label: {
    fontSize: font.xs,
    fontWeight: "700",
  },
  iconWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  iconActive: {
    backgroundColor: palette.accent + "22",
  },
  emojiWrap: {},
});
