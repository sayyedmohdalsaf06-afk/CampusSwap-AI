import { Text, View } from "react-native";

/**
 * Placeholder landing screen so Expo Router can boot. This is NOT a feature
 * screen — the real feed/auth/tab routes are added in later tasks.
 */
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-gray-900">CampusSwap AI</Text>
      <Text className="mt-2 text-base text-gray-500">
        Project foundations ready
      </Text>
    </View>
  );
}
