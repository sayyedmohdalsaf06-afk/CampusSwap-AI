import { ActivityIndicator, Pressable, Text, View } from "react-native";

/**
 * Primary action button (design §4.2). Supports a `loading` state that shows a
 * spinner and disables interaction — used to guard against duplicate
 * submissions while a mutation is in flight (Req 10.3).
 */
type PrimaryButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Optional leading icon element. */
  icon?: React.ReactNode;
  /** Visual variant. */
  variant?: "solid" | "outline";
};

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  icon,
  variant = "solid",
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  const solid = variant === "solid";

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      className={`flex-row items-center justify-center rounded-xl px-5 py-3.5 ${
        solid ? "bg-gray-900" : "border border-gray-300 bg-white"
      } ${isDisabled ? "opacity-50" : "active:opacity-80"}`}
    >
      {loading ? (
        <ActivityIndicator color={solid ? "#ffffff" : "#111827"} />
      ) : (
        <View className="flex-row items-center">
          {icon ? <View className="mr-2">{icon}</View> : null}
          <Text
            className={`text-base font-semibold ${
              solid ? "text-white" : "text-gray-900"
            }`}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export default PrimaryButton;
