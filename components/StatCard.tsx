import { Text, View } from "react-native";

/**
 * Small stat card used on the Profile screen to surface a single metric
 * (design §4.2 Profile — points earned, carbon saved; Req 6.4, 14.8). Purely
 * presentational: label on top, prominent value below, with an optional
 * caption for context (e.g. marking a value as a directional estimate,
 * Req 6.6).
 */
type StatCardProps = {
  label: string;
  value: string;
  /** Optional secondary line under the value (e.g. "CO₂e · estimate"). */
  caption?: string;
};

export function StatCard({ label, value, caption }: StatCardProps) {
  return (
    <View className="flex-1 rounded-2xl border border-gray-200 bg-white p-4">
      <Text className="text-xs uppercase tracking-wide text-gray-400">
        {label}
      </Text>
      <Text className="mt-1 text-2xl font-bold text-gray-900">{value}</Text>
      {caption ? (
        <Text className="mt-0.5 text-xs text-gray-400">{caption}</Text>
      ) : null}
    </View>
  );
}

export default StatCard;
