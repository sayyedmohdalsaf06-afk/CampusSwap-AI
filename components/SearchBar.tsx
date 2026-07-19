import { Pressable, Text, TextInput, View } from "react-native";
import { Search as SearchIcon } from "lucide-react-native";

import { colors } from "@/lib/theme";

/**
 * Rounded search field (design-system foundation). A white `rounded-2xl` field
 * with a leading search icon.
 *
 * When `readOnly` is set, the component renders a `Pressable` (no live text
 * input) that invokes `onPress` — used on the feed to tap through to the full
 * search screen.
 */
type SearchBarProps = {
  value?: string;
  onChangeText?: (text: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  onPress?: () => void;
};

export function SearchBar({
  value,
  onChangeText,
  placeholder = "Search listings",
  readOnly = false,
  onPress,
}: SearchBarProps) {
  if (readOnly) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={placeholder}
        className="flex-row items-center rounded-2xl border border-border bg-surface px-4 py-3 active:opacity-80"
      >
        <SearchIcon size={18} color={colors.subtle} />
        <Text className="ml-2 flex-1 text-base font-jakarta text-subtle">
          {value && value.length > 0 ? value : placeholder}
        </Text>
      </Pressable>
    );
  }

  return (
    <View className="flex-row items-center rounded-2xl border border-border bg-surface px-4 py-3">
      <SearchIcon size={18} color={colors.subtle} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.subtle}
        className="ml-2 flex-1 text-base font-jakarta text-ink"
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

export default SearchBar;
