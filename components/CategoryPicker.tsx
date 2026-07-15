import { Pressable, Text, View } from "react-native";

/**
 * Category picker (design §4.2 Create Listing; Req 3.8 — a category is required
 * to publish). Renders the seeded categories as selectable pills. Values are
 * lowercase snake_case and MUST match `carbon_category_map.category` so the
 * carbon baseline resolves at creation (Req 6.1).
 */

/** Seeded categories (see supabase/seed/reference.sql carbon_category_map). */
export const LISTING_CATEGORIES = [
  { value: "books", label: "Books" },
  { value: "electronics", label: "Electronics" },
  { value: "furniture", label: "Furniture" },
  { value: "hostel_essentials", label: "Hostel Essentials" },
  { value: "cycles", label: "Cycles" },
] as const;

export type ListingCategory = (typeof LISTING_CATEGORIES)[number]["value"];

type CategoryPickerProps = {
  value: string | null;
  onChange: (value: ListingCategory) => void;
};

export function CategoryPicker({ value, onChange }: CategoryPickerProps) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {LISTING_CATEGORIES.map((cat) => {
        const selected = cat.value === value;
        return (
          <Pressable
            key={cat.value}
            className={`rounded-full border px-3.5 py-2 active:opacity-70 ${
              selected
                ? "border-gray-900 bg-gray-900"
                : "border-gray-300 bg-white"
            }`}
            onPress={() => onChange(cat.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={cat.label}
          >
            <Text
              className={`text-sm font-medium ${
                selected ? "text-white" : "text-gray-700"
              }`}
            >
              {cat.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default CategoryPicker;
