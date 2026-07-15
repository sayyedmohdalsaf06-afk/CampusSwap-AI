import { Pressable, Text, View } from "react-native";

/**
 * Minimal segmented control (design §4.2 Create Listing — listing-type toggle,
 * Req 3.1). Generic over the option value so it can back a sell/donate toggle
 * or any other small either/or choice.
 */
export type SegmentedOption<T extends string> = {
  label: string;
  value: T;
};

type SegmentedProps<T extends string> = {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: SegmentedProps<T>) {
  return (
    <View className="flex-row rounded-xl bg-gray-100 p-1">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            className={`flex-1 items-center rounded-lg py-2.5 ${
              selected ? "bg-white" : ""
            }`}
            style={
              selected
                ? {
                    shadowColor: "#000",
                    shadowOpacity: 0.08,
                    shadowRadius: 3,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 1,
                  }
                : undefined
            }
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
          >
            <Text
              className={`text-sm font-semibold ${
                selected ? "text-gray-900" : "text-gray-500"
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default Segmented;
