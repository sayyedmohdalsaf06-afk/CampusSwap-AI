import { Text, View } from "react-native";

/**
 * Small colored pill (design-system foundation). Used for listing condition,
 * category captions, neutral tags, and success states. Tints are drawn from the
 * design palette (green / amber / blue / slate) via the Tailwind theme.
 */
type BadgeTone = "condition" | "category" | "neutral" | "success";

type BadgeProps = {
  label: string;
  tone?: BadgeTone;
};

const TONE_CONTAINER: Record<BadgeTone, string> = {
  // condition → amber tint
  condition: "bg-amber-bg",
  // category → blue tint
  category: "bg-blue-bg",
  // neutral → slate tint
  neutral: "bg-borderLight",
  // success → green tint
  success: "bg-green-50",
};

const TONE_TEXT: Record<BadgeTone, string> = {
  condition: "text-amber-text",
  category: "text-blue-text",
  neutral: "text-muted",
  success: "text-green-700",
};

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  return (
    <View className={`self-start rounded-full px-2.5 py-1 ${TONE_CONTAINER[tone]}`}>
      <Text className={`text-xs font-jakartaSemibold ${TONE_TEXT[tone]}`}>
        {label}
      </Text>
    </View>
  );
}

export default Badge;
