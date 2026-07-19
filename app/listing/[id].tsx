import { Pressable, ScrollView, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { EmptyState } from "@/components/EmptyState";
import { ListingDetail } from "@/components/ListingDetail";
import { ReservationActions } from "@/components/ReservationActions";
import { Skeleton } from "@/components/Skeleton";
import { useListing } from "@/hooks/useListings";
import { colors, shadows } from "@/lib/theme";

/**
 * Listing Detail screen (design §4.2 `listing/[id].tsx`, Req 4.6). Reads the
 * `id` route param, loads the listing via `useListing`, and renders the
 * presentational <ListingDetail /> plus <ReservationActions /> (the reservation
 * lifecycle UI — reserve / reserved / release / seller-complete, §1.6 Flow 6,
 * Req 13.1–13.8). Shows skeleton placeholders while loading and friendly
 * error / not-found states.
 */
export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: listing, isLoading, isError } = useListing(id);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Back affordance — rounded surface icon button (soft shadow) */}
      <View className="px-4 pb-2 pt-14">
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={shadows.soft}
          className="h-11 w-11 items-center justify-center rounded-2xl bg-surface active:opacity-70"
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
      </View>

      {isLoading ? (
        <ScrollView
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-10"
        >
          {/* Large image block */}
          <Skeleton width="100%" height={280} radius={0} />
          <View className="px-5 pt-5">
            <Skeleton width={96} height={24} radius={999} />
            <View className="mt-4">
              <Skeleton width="80%" height={26} radius={8} />
            </View>
            <View className="mt-3">
              <Skeleton width={120} height={26} radius={8} />
            </View>
            {/* Meta card lines */}
            <View className="mt-6 gap-3">
              <Skeleton width="100%" height={18} radius={8} />
              <Skeleton width="100%" height={18} radius={8} />
            </View>
            {/* Description lines */}
            <View className="mt-6 gap-2.5">
              <Skeleton width="100%" height={14} radius={6} />
              <Skeleton width="92%" height={14} radius={6} />
              <Skeleton width="70%" height={14} radius={6} />
            </View>
          </View>
        </ScrollView>
      ) : isError ? (
        <EmptyState
          icon="😕"
          title="We couldn't load this listing."
          subtitle="Something went wrong. Pull back and try again in a moment."
        />
      ) : !listing ? (
        <EmptyState
          icon="🔍"
          title="Listing not found"
          subtitle="It may have been removed or is no longer available."
        />
      ) : (
        <View className="flex-1">
          {/* Scrollable listing detail fills the available space… */}
          <ListingDetail listing={listing} />
          {/* …with the reservation actions pinned below it (design §4.2). */}
          <View className="pb-8">
            <ReservationActions listing={listing} />
          </View>
        </View>
      )}
    </View>
  );
}
