import { Tabs } from "expo-router";
import { Home, Search, User } from "lucide-react-native";

/**
 * Tabs navigator (design §4.2 `(tabs)` route group). Exposes the "Feed",
 * "Search", and "Profile" tabs; additional tabs (Need It) are added by later
 * phases. `(tabs)/index.tsx` maps to "/", so the authenticated app shell lands
 * there.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#111827",
        tabBarInactiveTintColor: "#9ca3af",
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
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
