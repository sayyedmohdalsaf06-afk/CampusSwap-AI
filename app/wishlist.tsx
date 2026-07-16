import { FlatList, Pressable, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { Skeleton } from "@/components/Skeleton";
import { useListingsByIds } from "@/hooks/useListings";
import { colors, shadows } from "@/lib/theme";
import { useWishlistStore } from "@/stores/wishlistStore";

/**
 * Wishlist screen (frontend-only stack route — NOT a tab). Renders the
 * listings saved to the LOCAL, device-only wishlist (`stores/wishlistStore`).
 *
 * // TODO(backend): persist wishlist server-side (e.g. a wishlists table + RLS)
 * // and sync across devices. This screen reads only local ids and fetches the
 * // corresponding listings read-only; listings hidden by RLS simply don't come
 * // back and are omitted.
 */
export default function WishlistScreen() {
  const router = useRouter();
  const ids = useWishlistStore((s) => s.ids);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header — rounded surface back button (soft shadow) + title. */}
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-14">
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={shadows.soft}
          className="h-11 w-11 items-center justify-center rounded-2xl bg-surface active:opacity-70"
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-xl font-jakartaBold text-ink">Wishlist</Text>
      </View>

      {ids.length === 0 ? (
        <EmptyState
          icon="🤍"
          title="Your wishlist is empty"
          subtitle="Tap the heart on any listing to save it here."
          action={{ label: "Browse the feed", onPress: () => router.push("/") }}
        />
      ) : (
        <WishlistBody ids={ids} />
      )}
    </View>
  );
}

/** Fetches + renders the saved listings for a non-empty wishlist. */
function WishlistBody({ ids }: { ids: string[] }) {
  const { data, isLoading, isError, refetch } = useListingsByIds(ids);

  // Initial-load skeletons — ListingCard-shaped placeholders.
  if (isLoading) {
    return (
      <View className="px-4 pt-2">
        {[0, 1, 2].map((i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </View>
    );
  }

  // Error + retry state.
  if (isError) {
    return (
      <EmptyState
        icon="⚠️"
        title="We couldn't load your wishlist."
        subtitle="Something went wrong while fetching your saved items."
        action={{ label: "Try again", onPress: () => refetch() }}
      />
    );
  }

  const listings = data ?? [];

  // All saved ids resolved to hidden/removed listings — nothing to show.
  if (listings.length === 0) {
    return (
      <EmptyState
        icon="🤍"
        title="Nothing to show yet"
        subtitle="Your saved items are no longer available."
      />
    );
  }

  return (
    <FlatList
      data={listings}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ListingCard listing={item} />}
      contentContainerClassName="px-4 pb-8 pt-2"
      showsVerticalScrollIndicator={false}
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
