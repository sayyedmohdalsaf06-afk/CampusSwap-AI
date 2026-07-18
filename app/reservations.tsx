import { FlatList, Pressable, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { ListingCardSkeleton } from "@/components/Skeletons";
import { useMyReservations } from "@/hooks/useReservation";
import { colors, shadows } from "@/lib/theme";
import { useAuthStore } from "@/stores/authStore";
import type { MyReservation, ReservationStatus } from "@/types";

/**
 * My Reservations screen (frontend-only stack route — NOT a tab). Read-only:
 * lists the current buyer's reservations (newest first) with each related
 * listing rendered via the shared `ListingCard`, tagged with a status badge.
 *
 * // TODO(auth): the acting user is read from `useAuthStore().profile`. Auth is
 * // intentionally paused for this slice — this screen NEVER mocks/fabricates a
 * // user. When `profile` is null we render a graceful "sign in" placeholder.
 */
export default function ReservationsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);

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
        <Text className="text-xl font-jakartaBold text-ink">My Reservations</Text>
      </View>

      {profile ? (
        <ReservationsList buyerId={profile.id} />
      ) : (
        <EmptyState
          icon="🔖"
          title="Sign in to view your reservations"
          subtitle="Items you reserve will appear here once you're signed in."
        />
      )}
    </View>
  );
}

/** Map a reservation status onto a Badge label + tone. */
function statusBadge(status: ReservationStatus): {
  label: string;
  tone: "condition" | "success" | "neutral";
} {
  switch (status) {
    case "active":
      return { label: "Reserved", tone: "condition" };
    case "completed":
      return { label: "Completed", tone: "success" };
    case "released":
    default:
      return { label: "Released", tone: "neutral" };
  }
}

/** Renders the reservations list for a present buyer id. */
function ReservationsList({ buyerId }: { buyerId: string }) {
  const router = useRouter();
  const { data, isLoading, isError, refetch } = useMyReservations(buyerId);

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
        title="We couldn't load your reservations."
        subtitle="Something went wrong while fetching your reservations."
        action={{ label: "Try again", onPress: () => refetch() }}
      />
    );
  }

  // Only keep reservations whose related listing is still visible (RLS may hide
  // a removed / cross-campus listing → null; those are skipped).
  const withListing = (data ?? []).filter(
    (r): r is MyReservation & { listing: NonNullable<MyReservation["listing"]> } =>
      r.listing != null
  );

  // Empty state.
  if (withListing.length === 0) {
    return (
      <EmptyState
        icon="🛍️"
        title="No reservations yet"
        subtitle="When you reserve an item, it'll show up here."
        action={{ label: "Browse the feed", onPress: () => router.push("/") }}
      />
    );
  }

  return (
    <FlatList
      data={withListing}
      keyExtractor={(item) => item.id}
      contentContainerClassName="px-4 pb-8 pt-2"
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const badge = statusBadge(item.status);
        return (
          <View className="mb-1">
            <View className="mb-2">
              <Badge label={badge.label} tone={badge.tone} />
            </View>
            <ListingCard listing={item.listing} />
          </View>
        );
      }}
    />
  );
}
