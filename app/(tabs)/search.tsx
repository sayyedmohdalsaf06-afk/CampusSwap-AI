import { useEffect, useState } from "react";
import { FlatList, ScrollView, Text, View } from "react-native";

import { CategoryChip } from "@/components/CategoryChip";
import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { SearchBar } from "@/components/SearchBar";
import { Skeleton } from "@/components/Skeleton";
import { LISTING_CATEGORIES } from "@/components/CategoryPicker";
import { useSearchListings } from "@/hooks/useListings";
import { shadows } from "@/lib/theme";

/**
 * Search / Filter screen (design §4.2 `(tabs)/search.tsx`, §1.6 Flow 4;
 * Req 2.2, 4.2, 4.3, 4.5, 4.6). Provides a debounced keyword search over the
 * campus feed plus a single-select category filter (with an "All" clear
 * option). Results come from `useSearchListings`, which searches active
 * listings only (Req 4.6) within the caller's campus (RLS — Req 2.2).
 *
 * Reskinned to the design system: soft background, design-system `SearchBar`
 * and `CategoryChip`, skeleton loading placeholders, and `EmptyState` for the
 * empty / error states. Search behavior (debounce, re-tap-to-clear) is
 * unchanged.
 */

/** Emoji glyphs for the filter chips — purely presentational. */
const CATEGORY_ICONS: Record<string, string> = {
  books: "📚",
  electronics: "💻",
  furniture: "🛋️",
  hostel_essentials: "🧺",
  cycles: "🚲",
};

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
    <View className="flex-1 bg-bg">
      {/* Header + search input */}
      <View className="px-5 pb-3 pt-14">
        <Text className="mb-3 text-2xl font-jakartaExtrabold text-ink">
          Search
        </Text>

        <SearchBar
          value={text}
          onChangeText={setText}
          placeholder="Search listings"
        />
      </View>

      {/* Category filter chips: "All" clears the filter (Req 4.3). */}
      <View className="pb-1">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="px-4"
          contentContainerClassName="gap-2 pr-4"
        >
          <CategoryChip
            icon="🛍️"
            label="All"
            active={category === null}
            onPress={() => setCategory(null)}
          />
          {LISTING_CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat.value}
              icon={CATEGORY_ICONS[cat.value]}
              label={cat.label}
              active={category === cat.value}
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

  // Loading skeletons — ListingCard-shaped placeholders.
  if (isLoading) {
    return (
      <View className="flex-1 px-4 pt-3">
        {[0, 1, 2].map((i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </View>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon="⚠️"
        title="We couldn't run your search."
        subtitle="Something went wrong. Please try again."
        action={{ label: "Try again", onPress: onRetry }}
      />
    );
  }

  // Empty state (Req 4.5) — friendlier hint when the user has active criteria.
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="🔍"
        title="No results found"
        subtitle={
          hasCriteria
            ? "Try a different keyword or adjust your category filter."
            : "There are no active listings in your campus yet."
        }
      />
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ListingCard listing={item} />}
      contentContainerClassName="px-4 pt-3 pb-8"
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    />
  );
}

/** A ListingCard-shaped loading placeholder: 4:3 cover block + text lines. */
function ListingCardSkeleton() {
  return (
    <View
      style={shadows.card}
      className="mb-3 overflow-hidden rounded-card bg-surface"
    >
      <Skeleton height={180} radius={0} />
      <View className="p-4">
        <Skeleton width="70%" height={16} />
        <Skeleton width="40%" height={12} className="mt-2" />
        <Skeleton width="30%" height={20} className="mt-3" />
      </View>
    </View>
  );
}
