import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Search as SearchIcon, X } from "lucide-react-native";

import { ListingCard } from "@/components/ListingCard";
import { LISTING_CATEGORIES } from "@/components/CategoryPicker";
import { useSearchListings } from "@/hooks/useListings";

/**
 * Search / Filter screen (design §4.2 `(tabs)/search.tsx`, §1.6 Flow 4;
 * Req 2.2, 4.2, 4.3, 4.5, 4.6). Provides a debounced keyword search over the
 * campus feed plus a single-select category filter (with an "All" clear
 * option). Results come from `useSearchListings`, which searches active
 * listings only (Req 4.6) within the caller's campus (RLS — Req 2.2).
 */
export default function SearchScreen() {
  // Raw input value (updates every keystroke) …
  const [text, setText] = useState("");
  // … and its debounced counterpart, which is what actually drives the query
  // so we don't hit the network on every keystroke (~300ms).
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(text), 300);
    return () => clearTimeout(handle);
  }, [text]);

  const { data, isLoading, isError, refetch } = useSearchListings(
    debouncedQuery,
    category
  );

  const listings = data ?? [];
  // Distinguish "no filters applied" from "filters applied but nothing matched"
  // so the empty state can nudge the user to adjust their search (Req 4.5).
  const hasCriteria = debouncedQuery.trim().length > 0 || category !== null;

  return (
    <View className="flex-1 bg-white">
      {/* Header + search input */}
      <View className="border-b border-gray-100 px-5 pb-3 pt-14">
        <Text className="mb-3 text-2xl font-bold text-gray-900">Search</Text>

        <View className="flex-row items-center rounded-xl border border-gray-300 bg-gray-50 px-3">
          <SearchIcon size={18} color="#9ca3af" />
          <TextInput
            className="ml-2 flex-1 py-2.5 text-base text-gray-900"
            placeholder="Search listings"
            placeholderTextColor="#9ca3af"
            value={text}
            onChangeText={setText}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search listings"
          />
          {text.length > 0 && (
            <Pressable
              onPress={() => setText("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={18} color="#9ca3af" />
            </Pressable>
          )}
        </View>

        {/* Category filter chips: "All" clears the filter (Req 4.3). */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mt-3 -mx-1"
          contentContainerClassName="px-1 gap-2"
        >
          <CategoryChip
            label="All"
            selected={category === null}
            onPress={() => setCategory(null)}
          />
          {LISTING_CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat.value}
              label={cat.label}
              selected={category === cat.value}
              // Re-tapping the active category clears it back to "All".
              onPress={() =>
                setCategory((prev) => (prev === cat.value ? null : cat.value))
              }
            />
          ))}
        </ScrollView>
      </View>

      <SearchBody
        isLoading={isLoading}
        isError={isError}
        listings={listings}
        hasCriteria={hasCriteria}
        onRetry={() => refetch()}
      />
    </View>
  );
}

type CategoryChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

/** A single selectable category pill mirroring the CategoryPicker styling. */
function CategoryChip({ label, selected, onPress }: CategoryChipProps) {
  return (
    <Pressable
      className={`rounded-full border px-3.5 py-1.5 active:opacity-70 ${
        selected ? "border-gray-900 bg-gray-900" : "border-gray-300 bg-white"
      }`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text
        className={`text-sm font-medium ${
          selected ? "text-white" : "text-gray-700"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type SearchBodyProps = {
  isLoading: boolean;
  isError: boolean;
  listings: ReturnType<typeof useSearchListings>["data"];
  hasCriteria: boolean;
  onRetry: () => void;
};

/** Renders the loading / error / empty / list states for search results. */
function SearchBody({
  isLoading,
  isError,
  listings,
  hasCriteria,
  onRetry,
}: SearchBodyProps) {
  const rows = listings ?? [];

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#111827" />
      </View>
    );
  }

  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-base text-gray-700">
          We couldn't run your search.
        </Text>
        <Pressable
          className="mt-4 rounded-lg bg-gray-900 px-5 py-2.5 active:opacity-80"
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
        >
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </View>
    );
  }

  // Empty state (Req 4.5) — friendlier hint when the user has active criteria.
  if (rows.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-base font-medium text-gray-900">
          No results found
        </Text>
        <Text className="mt-1 text-center text-sm text-gray-500">
          {hasCriteria
            ? "Try a different keyword or adjust your category filter."
            : "There are no active listings in your campus yet."}
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ListingCard listing={item} />}
      contentContainerClassName="px-4 pt-4 pb-8"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    />
  );
}
