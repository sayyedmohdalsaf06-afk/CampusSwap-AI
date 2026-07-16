import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { shadows } from "@/lib/theme";

/**
 * Small stat card used on the Profile screen to surface a single metric
 * (design §4.2 Profile — points earned, carbon saved; Req 6.4, 14.8). Purely
 * presentational: an optional leading icon + uppercase label, a prominent
 * value, and an optional caption for context (e.g. marking a value as a
 * directional estimate, Req 6.6).
 *
 * Reskinned to the design system: rounded-2xl `bg-surface` card with a soft
 * shadow and Plus Jakarta typography.
 */
type StatCardProps = {
  label: string;
  value: string;
  /** Optional secondary line under the value (e.g. "CO₂e · estimate"). */
  caption?: string;
  /** Optional small icon rendered beside the label (backward compatible). */
  icon?: ReactNode;
};

export function StatCard({ label, value, caption, icon }: StatCardProps) {
  return (
    <View
      style={shadows.soft}
      className="flex-1 rounded-2xl bg-surface p-4"
    >
      <View className="flex-row items-center">
        {icon ? <View className="mr-1.5">{icon}</View> : null}
        <Text className="text-xs font-jakartaMedium uppercase tracking-wide text-subtle">
          {label}
        </Text>
      </View>
      <Text className="mt-1.5 text-2xl font-jakartaExtrabold text-ink">
        {value}
      </Text>
      {caption ? (
        <Text className="mt-0.5 text-xs font-jakarta text-subtle">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

export default StatCard;
