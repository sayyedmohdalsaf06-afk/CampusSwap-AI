import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { shadows } from "@/lib/theme";

/**
 * Horizontal category chip (design-system foundation). A pill with an optional
 * leading icon/emoji; the active chip is solid green with white text, inactive
 * chips are white with a subtle border.
 *
 * Note: this is the horizontal scrolling chip used in feed/search headers. The
 * existing `CategoryPicker` (wrap-selecting create-listing categories) is a
 * separate component and is intentionally left unchanged.
 */
type CategoryChipProps = {
  /** Leading content — typically an emoji string or a lucide icon element. */
  icon?: ReactNode;
  label: string;
  active?: boolean;
  onPress?: () => void;
};

export function CategoryChip({
  icon,
  label,
  active = false,
  onPress,
}: CategoryChipProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      style={active ? undefined : shadows.soft}
      className={`flex-row items-center rounded-full px-4 py-2.5 active:opacity-80 ${
        active ? "bg-primary" : "border border-border bg-surface"
      }`}
    >
      {icon != null ? (
        <View className="mr-1.5">
          {typeof icon === "string" ? <Text className="text-sm">{icon}</Text> : icon}
        </View>
      ) : null}
      <Text
        className={`text-sm font-jakartaSemibold ${
          active ? "text-white" : "text-ink"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default CategoryChip;
