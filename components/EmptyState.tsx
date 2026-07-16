import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/Button";

/**
 * Centered empty / zero-data state (design-system foundation). Shows a large
 * emoji (or custom node), a title, an optional subtitle, and an optional
 * primary action button. Used for empty feeds, no search results, etc.
 */
type EmptyStateProps = {
  /** An emoji string (rendered large) or a custom React node (e.g. an icon). */
  icon: string | ReactNode;
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
};

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 py-16">
      {typeof icon === "string" ? (
        <Text className="text-5xl">{icon}</Text>
      ) : (
        <View>{icon}</View>
      )}

      <Text className="mt-4 text-center text-lg font-jakartaBold text-ink">
        {title}
      </Text>

      {subtitle ? (
        <Text className="mt-1.5 text-center text-sm font-jakarta text-muted">
          {subtitle}
        </Text>
      ) : null}

      {action ? (
        <View className="mt-6">
          <Button label={action.label} onPress={action.onPress} size="lg" />
        </View>
      ) : null}
    </View>
  );
}

export default EmptyState;
