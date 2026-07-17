import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Leaf, LogOut, Plus } from "lucide-react-native";

import { CategoryChip } from "@/components/CategoryChip";
import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { SearchBar } from "@/components/SearchBar";
import { Skeleton } from "@/components/Skeleton";
import { LISTING_CATEGORIES } from "@/components/CategoryPicker";
import { flattenFeed, useFeed } from "@/hooks/useListings";
import { supabase } from "@/lib/supabase";
import { colors, gradients, shadows } from "@/lib/theme";
import { signOut } from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";

/**
 * Campus feed / Home screen (design §4.2 `(tabs)/index.tsx`, §1.6 Flow 4;
 * Req 4.1, 4.6, 8.1, 8.2, 9.1). Renders the campus-scoped active-listing feed
 * (RLS enforces campus scope — Req 2.2) with a FlatList of ListingCard, loading
 * / empty / error states, and incremental pagination via `onEndReached`.
 *
 * Reskinned to the design system: soft background, rounded/shadowed header
 * actions, a tap-through SearchBar, a green eco gradient hero banner, and a
 * horizontal category browse row that routes to the Search tab (filtering lives
 * there — no new query logic is added to the feed).
 */

/** Emoji glyphs for the browse chips — purely presentational. */
const CATEGORY_ICONS: Record<string, string> = {
  books: "📚",
  electronics: "💻",
  furniture: "🛋️",
  hostel_essentials: "🧺",
  cycles: "🚲",
};

export default function FeedScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);
  const reset = useAuthStore((s) => s.reset);

  const [campusName, setCampusName] = useState<string | null>(null);

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFeed();

  const listings = flattenFeed(data);

  // Resolve the assigned campus name for the header (Req 6.5/label context).
  useEffect(() => {
    let active = true;
    (async () => {
      if (!profile?.campus_id) {
        if (active) setCampusName(null);
        return;
      }
      const { data: campus } = await supabase
        .from("campuses")
        .select("name")
        .eq("id", profile.campus_id)
        .maybeSingle();
      if (!active) return;
      setCampusName((campus?.name as string | undefined) ?? null);
    })();
    return () => {
      active = false;
    };
  }, [profile?.campus_id]);

  async function onSignOut() {
    await signOut();
    reset(); // auth gate routes back to (auth)/email
  }

  return (
    <View className="flex-1 bg-bg">
      {/* Header: campus name + create / sign out actions */}
      <View className="flex-row items-center justify-between px-5 pb-3 pt-14">
        <View className="flex-1 pr-3">
          <Text className="text-xs font-jakartaMedium uppercase tracking-wide text-subtle">
            Your campus
          </Text>
          <Text
            className="text-2xl font-jakartaExtrabold text-ink"
            numberOfLines={1}
          >
            {campusName ?? "CAMPLX"}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {/* Create-listing entry point (design §4.2 → listing/create). */}
          <Pressable
            style={shadows.soft}
            className="h-11 w-11 items-center justify-center rounded-2xl bg-primary active:opacity-80"
            onPress={() => router.push("/listing/create")}
            accessibilityRole="button"
            accessibilityLabel="Create a listing"
          >
            <Plus size={22} color="#ffffff" />
          </Pressable>
          <Pressable
            style={shadows.soft}
            className="h-11 w-11 items-center justify-center rounded-2xl border border-border bg-surface active:opacity-70"
            onPress={onSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <LogOut size={18} color={colors.muted} />
          </Pressable>
        </View>
      </View>

      <FeedBody
        isLoading={isLoading}
        isError={isError}
        listings={listings}
        onRetry={() => refetch()}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) fetchNextPage();
        }}
        isFetchingNextPage={isFetchingNextPage}
        onOpenSearch={() => router.push("/(tabs)/search")}
        onCreate={() => router.push("/listing/create")}
        onOpenSustainability={() => router.push("/sustainability")}
      />
    </View>
  );
}

type FeedBodyProps = {
  isLoading: boolean;
  isError: boolean;
  listings: ReturnType<typeof flattenFeed>;
  onRetry: () => void;
  onEndReached: () => void;
  isFetchingNextPage: boolean;
  onOpenSearch: () => void;
  onCreate: () => void;
  onOpenSustainability: () => void;
};

/** Renders the loading / error / empty / list states for the feed. */
function FeedBody({
  isLoading,
  isError,
  listings,
  onRetry,
  onEndReached,
  isFetchingNextPage,
  onOpenSearch,
  onCreate,
  onOpenSustainability,
}: FeedBodyProps) {
  // The header block (search + hero banner + browse chips) is shared across the
  // loading and populated states so the chrome stays put while content loads.
  const header = (
    <View>
      {/* Tap-through search field → full Search tab. */}
      <SearchBar
        readOnly
        placeholder="Search listings"
        onPress={onOpenSearch}
      />

      {/* Green eco hero banner (design-system gradient) — tappable → the
          Sustainability dashboard. Visuals are unchanged; the Pressable just
          adds a press affordance. */}
      <Pressable
        onPress={onOpenSustainability}
        accessibilityRole="button"
        accessibilityLabel="View your sustainability impact"
        className="mt-4 active:opacity-90"
      >
        <LinearGradient
          colors={gradients.greenBanner as unknown as [string, string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[shadows.card, { borderRadius: 20 }]}
          className="overflow-hidden rounded-card p-5"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-lg font-jakartaExtrabold text-white">
                Save the planet, one swap at a time
              </Text>
              <Text className="mt-1 text-sm font-jakarta text-white/85">
                Every reused item keeps CO₂ out of the air. Swap, don't shop. 🌱
              </Text>
            </View>
            <View className="h-14 w-14 items-center justify-center rounded-full bg-white/20">
              <Leaf size={26} color="#ffffff" />
            </View>
          </View>
        </LinearGradient>
      </Pressable>

      {/* Horizontal browse chips → route to Search (filtering lives there). */}
      <View className="mt-4">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="-mx-1"
          contentContainerClassName="px-1 gap-2"
        >
          <CategoryChip icon="🛍️" label="All" onPress={onOpenSearch} />
          {LISTING_CATEGORIES.map((cat) => (
            <CategoryChip
              key={cat.value}
              icon={CATEGORY_ICONS[cat.value]}
              label={cat.label}
              onPress={onOpenSearch}
            />
          ))}
        </ScrollView>
      </View>

      <Text className="mb-1 mt-5 text-base font-jakartaBold text-ink">
        Fresh on campus
      </Text>
    </View>
  );

  // Initial-load skeletons — ListingCard-shaped placeholders (Req 8.1).
  if (isLoading) {
    return (
      <View className="flex-1 px-4 pt-2">
        {header}
        <View className="mt-1">
          {[0, 1, 2].map((i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </View>
      </View>
    );
  }

  // Error + retry state.
  if (isError) {
    return (
      <View className="flex-1 px-4 pt-2">
        {header}
        <EmptyState
          icon="⚠️"
          title="We couldn't load the feed."
          subtitle="Something went wrong while fetching listings for your campus."
          action={{ label: "Try again", onPress: onRetry }}
        />
      </View>
    );
  }

  // Empty state (Req 4.5-style friendly message for an empty campus feed).
  if (listings.length === 0) {
    return (
      <View className="flex-1 px-4 pt-2">
        {header}
        <EmptyState
          icon="🌱"
          title="No listings in your campus yet"
          subtitle="Be the first to list something for your campus community."
          action={{ label: "Create a listing", onPress: onCreate }}
        />
      </View>
    );
  }

  return (
    <FlatList
      data={listings}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ListingCard listing={item} />}
      ListHeaderComponent={header}
      contentContainerClassName="px-4 pt-2 pb-8"
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator className="my-4" color={colors.primary} />
        ) : null
      }
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
