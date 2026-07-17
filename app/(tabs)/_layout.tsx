import { Tabs } from "expo-router";
import { Home, Megaphone, Search, User } from "lucide-react-native";

import { colors } from "@/lib/theme";

/**
 * Tabs navigator (design §4.2 `(tabs)` route group). Exposes the "Feed",
 * "Search", "Need It", and "Profile" tabs. `(tabs)/index.tsx` maps to "/", so
 * the authenticated app shell lands there.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Subtle cross-tab transition (bottom-tabs v7 / Expo SDK 54).
        animation: "shift",
        // Design-system accent: active tabs use the primary green, inactive use subtle.
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.subtle,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Feed",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: "Search",
          tabBarIcon: ({ color, size }) => <Search color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="needit"
        options={{
          title: "Need It",
          tabBarIcon: ({ color, size }) => (
            <Megaphone color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
