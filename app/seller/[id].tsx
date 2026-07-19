import { FlatList, Pressable, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Leaf, Sparkles, User } from "lucide-react-native";

import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { Skeleton } from "@/components/Skeleton";
import { usePublicProfile, useSellerListings } from "@/hooks/useListings";
import { colors, shadows } from "@/lib/theme";
import type { PublicProfile } from "@/services/listingService";
import type { ListingWithImages } from "@/types";
import { formatCarbonKg } from "@/utils/format";

/**
 * Public Seller Profile (frontend-only dynamic stack route — NOT a tab).
 * Reads the `id` route param, best-effort fetches a public-safe profile, and
 * lists the seller's ACTIVE listings. Follows the `listing/[id].tsx`
 * dynamic-route + Stack.Screen pattern.
 *
 * Graceful degradation: the current RLS policy may restrict `profiles` reads to
 * the row owner, so `usePublicProfile` can return null for other sellers — in
 * that case we show a neutral "Campus seller" header and hide personal stats.
 * The listings query is campus-scoped by RLS and degrades to a friendly empty
 * state when nothing is returned.
 *
 * // TODO(backend): expose public-safe seller fields (name, impact) + a seller
 * // rating via a view/policy so the header reliably shows real data.
 */
export default function SellerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: profile } = usePublicProfile(id);
  const {
    data: listings,
    isLoading,
    isError,
    refetch,
  } = useSellerListings(id);

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
        <Text className="text-xl font-jakartaBold text-ink">Seller</Text>
      </View>

      <SellerBody
        profile={profile ?? null}
        listings={listings ?? []}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
      />
    </View>
  );
}

/** Derive up-to-two-letter initials from a display name. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type SellerBodyProps = {
  profile: PublicProfile | null;
  listings: ListingWithImages[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

/** Renders the seller header + their active listings (list/grid). */
function SellerBody({
  profile,
  listings,
  isLoading,
  isError,
  onRetry,
}: SellerBodyProps) {
  // Header: real profile when the read succeeds, else a neutral fallback.
  const hasProfile = profile != null;
  const displayName = profile?.display_name?.trim();
  const headerName = displayName && displayName.length > 0 ? displayName : "Campus seller";

  const header = (
    <View className="pb-4">
      <View style={shadows.card} className="rounded-2xl bg-surface p-5">
        <View className="flex-row items-center">
          <View className="h-16 w-16 items-center justify-center rounded-full bg-green-50">
            {hasProfile && displayName ? (
              <Text className="text-xl font-jakartaExtrabold text-green-700">
                {initialsOf(displayName)}
              </Text>
            ) : (
              <User size={26} color={colors.green[600]} />
            )}
          </View>
          <View className="ml-4 flex-1">
            <Text
              className="text-xl font-jakartaExtrabold text-ink"
              numberOfLines={1}
            >
              {headerName}
            </Text>
            <Text className="mt-0.5 text-xs font-jakartaMedium uppercase tracking-wide text-subtle">
              Seller on your campus
            </Text>
          </View>
        </View>

        {/* Personal impact stats — only when a public profile was returned. */}
        {hasProfile ? (
          <View className="mt-4 flex-row gap-3">
            <View className="flex-1 rounded-2xl bg-borderLight px-3 py-2.5">
              <View className="flex-row items-center">
                <Sparkles size={13} color={colors.primaryDark} />
                <Text className="ml-1 text-xs font-jakartaMedium uppercase tracking-wide text-subtle">
                  Points
                </Text>
              </View>
              <Text className="mt-1 text-lg font-jakartaExtrabold text-ink">
                {profile.points}
              </Text>
            </View>
            <View className="flex-1 rounded-2xl bg-borderLight px-3 py-2.5">
              <View className="flex-row items-center">
                <Leaf size={13} color={colors.primaryDark} />
                <Text className="ml-1 text-xs font-jakartaMedium uppercase tracking-wide text-subtle">
                  Carbon saved
                </Text>
              </View>
              <Text className="mt-1 text-lg font-jakartaExtrabold text-ink">
                {formatCarbonKg(profile.cumulative_carbon_g)}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <Text className="mt-6 text-lg font-jakartaBold text-ink">
        Active listings
      </Text>
    </View>
  );

  // Loading — header + ListingCard-shaped skeletons.
  if (isLoading) {
    return (
      <View className="flex-1 px-4 pt-1">
        {header}
        {[0, 1].map((i) => (
          <ListingCardSkeleton key={i} />
        ))}
      </View>
    );
  }

  // Error + retry.
  if (isError) {
    return (
      <View className="flex-1 px-4 pt-1">
        {header}
        <EmptyState
          icon="⚠️"
          title="We couldn't load this seller."
          subtitle="Something went wrong while fetching their listings."
          action={{ label: "Try again", onPress: onRetry }}
        />
      </View>
    );
  }

  // Empty — no active listings from this seller.
  if (listings.length === 0) {
    return (
      <View className="flex-1 px-4 pt-1">
        {header}
        <EmptyState
          icon="📭"
          title="No active listings from this seller"
          subtitle="This seller doesn't have anything available right now. Check back later."
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
      contentContainerClassName="px-4 pb-8 pt-1"
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
