import { Tabs } from "expo-router";
import { Home } from "lucide-react-native";

/**
 * Tabs navigator (design §4.2 `(tabs)` route group). For this slice there is a
 * SINGLE "Feed" tab — additional tabs (Search, Need It, Profile) are added by
 * later phases. `(tabs)/index.tsx` maps to "/", so the authenticated app shell
 * lands here.
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
    </Tabs>
  );
}
