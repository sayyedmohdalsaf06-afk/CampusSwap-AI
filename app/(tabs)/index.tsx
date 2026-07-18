import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Bell, Leaf, LogOut, Plus, Sparkles } from "lucide-react-native";

import { CategoryChip } from "@/components/CategoryChip";
import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { SearchBar } from "@/components/SearchBar";
import { ListingCardSkeleton } from "@/components/Skeletons";
import { LISTING_CATEGORIES } from "@/components/CategoryPicker";
import { flattenFeed, useFeed } from "@/hooks/useListings";
import { supabase } from "@/lib/supabase";
import { colors, gradients, shadows } from "@/lib/theme";
import { signOut } from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";
import { formatCarbonKg } from "@/utils/format";

/**
 * Campus feed / Home screen (design §4.2 `(tabs)/index.tsx`, §1.6 Flow 4;
 * Req 4.1, 4.6, 8.1, 8.2, 9.1). Renders the campus-scoped active-listing feed
 * (RLS enforces campus scope — Req 2.2) with a FlatList of ListingCard, loading
 * / empty / error states, and incremental pagination via `onEndReached`.
 *
 * Premium reskin (CAMPLX): white surfaces + deep-navy ink + violet accents with
 * soft shadows. The header pairs a two-line greeting with a navy primary CTA and
 * a decorative bell; the old dominant green gradient banner is replaced by two
 * compact stat cards (green is now only a small sustainability accent). Category
 * pills and the tap-through search field route to the Search tab — no new query
 * logic is added to the feed.
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

  // Guarded stat-card values — read only from the already-loaded profile; no new
  // query is issued. `formatCarbonKg` renders "0 kg" when the value is missing.
  const carbonSaved = formatCarbonKg(profile?.cumulative_carbon_g);
  const rewardPoints = String(profile?.points ?? 0);

  return (
    <View className="flex-1 bg-bg">
      {/* Header: two-line greeting + decorative bell, subtle sign-out, navy CTA */}
      <View className="flex-row items-start justify-between px-5 pb-4 pt-14">
        <View className="flex-1 pr-3">
          <Text className="text-sm font-jakartaMedium text-muted">
            Good evening 👋
          </Text>
          <Text
            className="mt-1 text-2xl font-jakartaExtrabold text-ink"
            numberOfLines={2}
          >
            Find something useful today.
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          {/* Decorative notification bell — no backend wiring (no-op onPress).
              The violet dot is a purely cosmetic premium touch. */}
          <View>
            <Pressable
              style={shadows.soft}
              className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface active:opacity-70"
              onPress={() => {}}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
            >
              <Bell size={20} color={colors.ink} />
            </Pressable>
            <View className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-violet-base" />
          </View>

          {/* Sign-out kept as a subtle white surface circle (same handler). */}
          <Pressable
            style={shadows.soft}
            className="h-11 w-11 items-center justify-center rounded-full border border-border bg-surface active:opacity-70"
            onPress={onSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <LogOut size={18} color={colors.muted} />
          </Pressable>

          {/* Primary CTA — filled navy (design §4.2 → listing/create). */}
          <Pressable
            style={shadows.soft}
            className="h-11 w-11 items-center justify-center rounded-full bg-ink active:opacity-80"
            onPress={() => router.push("/listing/create")}
            accessibilityRole="button"
            accessibilityLabel="Create a listing"
          >
            <Plus size={22} color="#ffffff" />
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
        carbonSaved={carbonSaved}
        rewardPoints={rewardPoints}
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
  carbonSaved: string;
  rewardPoints: string;
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
  carbonSaved,
  rewardPoints,
}: FeedBodyProps) {
  // The header block (search + stat cards + browse pills) is shared across the
  // loading and populated states so the chrome stays put while content loads.
  const header = (
    <View>
      {/* Tap-through search field → full Search tab. */}
      <SearchBar
        readOnly
        placeholder="Search books, cycles, furniture…"
        onPress={onOpenSearch}
      />

      {/* Compact stat cards replace the old green banner. Card A is a premium
          deep-navy sustainability card (green survives only as the leaf accent);
          Card B is a white surface with the violet reward accent for contrast.
          `items-stretch` keeps both cards equal height. Card A stays tappable →
          the Sustainability dashboard. */}
      <View className="mt-5 flex-row items-stretch gap-3">
        <Pressable
          onPress={onOpenSustainability}
          style={shadows.card}
          className="flex-1 overflow-hidden rounded-card active:opacity-90"
          accessibilityRole="button"
          accessibilityLabel="View your sustainability impact"
        >
          <LinearGradient
            colors={gradients.brandNavy as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flex: 1 }}
            className="p-4"
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-white/10">
              <Leaf size={18} color={colors.primary} />
            </View>
            <Text
              className="mt-2.5 text-xl font-jakartaExtrabold text-white"
              numberOfLines={1}
            >
              {carbonSaved}
            </Text>
            <Text
              className="mt-0.5 text-xs font-jakartaMedium text-white/70"
              numberOfLines={1}
            >
              CO₂ saved
            </Text>
          </LinearGradient>
        </Pressable>

        <View
          style={shadows.soft}
          className="flex-1 rounded-card bg-surface p-4"
        >
          <View className="h-9 w-9 items-center justify-center rounded-full bg-violet-bg">
            <Sparkles size={18} color={colors.violet.base} />
          </View>
          <Text
            className="mt-2.5 text-xl font-jakartaExtrabold text-ink"
            numberOfLines={1}
          >
            {rewardPoints}
          </Text>
          <Text
            className="mt-0.5 text-xs font-jakartaMedium text-muted"
            numberOfLines={1}
          >
            Reward points
          </Text>
        </View>
      </View>

      {/* Horizontal browse pills → route to Search (filtering lives there). */}
      <View className="mt-5">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="pr-1 gap-2"
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

      <Text className="mb-2 mt-6 text-lg font-jakartaBold text-ink">
        Fresh on campus
      </Text>
    </View>
  );

  // Initial-load skeletons — ListingCard-shaped placeholders (Req 8.1).
  if (isLoading) {
    return (
      <View className="flex-1 px-5 pt-2">
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
      <View className="flex-1 px-5 pt-2">
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
      <View className="flex-1 px-5 pt-2">
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
      contentContainerClassName="px-5 pt-2 pb-8"
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
