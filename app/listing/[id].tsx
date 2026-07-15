import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft } from "lucide-react-native";

import { ListingDetail } from "@/components/ListingDetail";
import { ReservationActions } from "@/components/ReservationActions";
import { useListing } from "@/hooks/useListings";

/**
 * Listing Detail screen (design §4.2 `listing/[id].tsx`, Req 4.6). Reads the
 * `id` route param, loads the listing via `useListing`, and renders the
 * presentational <ListingDetail /> plus <ReservationActions /> (the reservation
 * lifecycle UI — reserve / reserved / release / seller-complete, §1.6 Flow 6,
 * Req 13.1–13.8). Shows a loading spinner and a friendly not-found state.
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
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Back affordance */}
      <View className="flex-row items-center px-3 pb-2 pt-14">
        <Pressable
          className="flex-row items-center rounded-lg px-2 py-2 active:opacity-60"
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={22} color="#111827" />
          <Text className="text-base font-medium text-gray-900">Back</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#111827" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-base text-gray-700">
            We couldn't load this listing.
          </Text>
        </View>
      ) : !listing ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-base font-medium text-gray-900">
            Listing not found
          </Text>
          <Text className="mt-1 text-center text-sm text-gray-500">
            It may have been removed or is no longer available.
          </Text>
        </View>
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
