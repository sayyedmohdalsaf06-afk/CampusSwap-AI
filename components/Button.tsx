import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors, shadows } from "@/lib/theme";

/**
 * Primary action button (design-system foundation). Solid green primary,
 * outline, and ghost variants with `md`/`lg` sizing. The `loading` state shows
 * a spinner and disables interaction to guard against duplicate submissions
 * while a mutation is in flight.
 *
 * Accepts either a `label` string or arbitrary `children` for custom content.
 */
type ButtonVariant = "primary" | "outline" | "ghost";
type ButtonSize = "md" | "lg";

type ButtonProps = {
  label?: string;
  children?: ReactNode;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Optional leading icon element. */
  icon?: ReactNode;
};

const VARIANT_CONTAINER: Record<ButtonVariant, string> = {
  primary: "bg-primary",
  outline: "border border-border bg-surface",
  ghost: "bg-transparent",
};

const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: "text-white",
  outline: "text-ink",
  ghost: "text-ink",
};

const SIZE_CONTAINER: Record<ButtonSize, string> = {
  md: "px-4 py-2.5 rounded-[16px]",
  lg: "px-5 py-3.5 rounded-button",
};

const SIZE_TEXT: Record<ButtonSize, string> = {
  md: "text-sm",
  lg: "text-base",
};

export function Button({
  label,
  children,
  onPress,
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled = false,
  icon,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  // Apply a subtle elevation to solid/outlined variants (not ghost) while the
  // button is actionable. Disabled buttons stay flat.
  const showShadow =
    !isDisabled && (variant === "primary" || variant === "outline");

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        showShadow ? shadows.soft : undefined,
        { transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      className={`flex-row items-center justify-center ${SIZE_CONTAINER[size]} ${
        VARIANT_CONTAINER[variant]
      } ${fullWidth ? "w-full" : ""} ${
        isDisabled ? "opacity-50" : "active:opacity-80"
      }`}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "primary" ? "#ffffff" : colors.ink}
        />
      ) : (
        <View className="flex-row items-center">
          {icon ? <View className="mr-2">{icon}</View> : null}
          {children ??
            (label ? (
              <Text
                className={`font-jakartaBold ${SIZE_TEXT[size]} ${VARIANT_TEXT[variant]}`}
              >
                {label}
              </Text>
            ) : null)}
        </View>
      )}
    </Pressable>
  );
}

export default Button;
