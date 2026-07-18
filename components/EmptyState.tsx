import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MotiView } from "moti";

import { Button } from "@/components/Button";
import { colors, shadows } from "@/lib/theme";

/**
 * Centered empty / zero-data state (design-system foundation). Shows a premium
 * "illustration" container (a soft, tinted rounded-full circle) holding a large
 * emoji (or custom node), a title, an optional subtitle, and an optional
 * primary action button. Used for empty feeds, no search results, etc.
 *
 * The whole block gently animates in via Moti. An optional `tone` tints the
 * illustration circle (neutral / violet / green) to match the surrounding
 * screen — it defaults to "neutral" so every existing caller keeps working
 * unchanged.
 */
type EmptyStateTone = "neutral" | "violet" | "green";

type EmptyStateProps = {
  /** An emoji string (rendered large) or a custom React node (e.g. an icon). */
  icon: string | ReactNode;
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
  /** Tints the illustration circle. Defaults to "neutral". */
  tone?: EmptyStateTone;
};

/**
 * Soft two-stop gradient tints for the illustration circle, keyed by tone. Each
 * fades a subtle surface tint into white for a gentle, premium "soft light"
 * look (values mirror `lib/theme` tokens).
 */
const TONE_GRADIENTS: Record<EmptyStateTone, [string, string]> = {
  neutral: [colors.borderLight, colors.surface],
  violet: [colors.violet.bg, colors.surface],
  green: [colors.green[50], colors.surface],
};

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  tone = "neutral",
}: EmptyStateProps) {
  return (
    <MotiView
      from={{ opacity: 0, translateY: 12 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 380 }}
      className="flex-1 items-center justify-center px-8 py-16"
    >
      {/* Premium illustration container: a soft, tinted rounded-full circle
          with a subtle shadow. Gives an "illustration" feel with no assets. */}
      <LinearGradient
        colors={TONE_GRADIENTS[tone]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[shadows.soft, { width: 96, height: 96, borderRadius: 999 }]}
        className="items-center justify-center"
      >
        {typeof icon === "string" ? (
          <Text className="text-5xl">{icon}</Text>
        ) : (
          <View>{icon}</View>
        )}
      </LinearGradient>

      <Text className="mt-6 text-center text-lg font-jakartaBold text-ink">
        {title}
      </Text>

      {subtitle ? (
        <Text className="mt-2 text-center text-sm font-jakarta text-muted">
          {subtitle}
        </Text>
      ) : null}

      {action ? (
        <View className="mt-7">
          <Button label={action.label} onPress={action.onPress} size="lg" />
        </View>
      ) : null}
    </MotiView>
  );
}

export default EmptyState;
