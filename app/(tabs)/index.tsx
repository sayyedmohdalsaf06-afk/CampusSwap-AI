import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LogOut, Plus } from "lucide-react-native";

import { ListingCard } from "@/components/ListingCard";
import { flattenFeed, useFeed } from "@/hooks/useListings";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";

/**
 * Campus feed / Home screen (design §4.2 `(tabs)/index.tsx`, §1.6 Flow 4;
 * Req 4.1, 4.6, 8.1, 8.2, 9.1). Renders the campus-scoped active-listing feed
 * (RLS enforces campus scope — Req 2.2) with a FlatList of ListingCard, loading
 * / empty / error states, and incremental pagination via `onEndReached`.
 *
 * The header shows the signed-in student's campus name and a Sign out action —
 * this replaces the old placeholder app shell (`app/index.tsx`), which is
 * removed in favor of this route serving "/".
 */
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
    <View className="flex-1 bg-white">
      {/* Header: campus name + sign out */}
      <View className="flex-row items-center justify-between border-b border-gray-100 px-5 pb-3 pt-14">
        <View>
          <Text className="text-xs uppercase tracking-wide text-gray-400">
            Your campus
          </Text>
          <Text className="text-lg font-bold text-gray-900">
            {campusName ?? "CampusSwap"}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          {/* Create-listing entry point (design §4.2 → listing/create). */}
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full bg-gray-900 active:opacity-80"
            onPress={() => router.push("/listing/create")}
            accessibilityRole="button"
            accessibilityLabel="Create a listing"
          >
            <Plus size={20} color="#ffffff" />
          </Pressable>
          <Pressable
            className="flex-row items-center rounded-lg border border-gray-300 px-3 py-2 active:opacity-70"
            onPress={onSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <LogOut size={16} color="#111827" />
            <Text className="ml-1.5 text-sm font-semibold text-gray-900">
              Sign out
            </Text>
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
};

/** Renders the loading / error / empty / list states for the feed. */
function FeedBody({
  isLoading,
  isError,
  listings,
  onRetry,
  onEndReached,
  isFetchingNextPage,
}: FeedBodyProps) {
  // Initial-load spinner (Req 8.1).
  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#111827" />
      </View>
    );
  }

  // Error + retry state.
  if (isError) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-base text-gray-700">
          We couldn't load the feed.
        </Text>
        <Pressable
          className="mt-4 rounded-lg bg-gray-900 px-5 py-2.5 active:opacity-80"
          onPress={onRetry}
        >
          <Text className="text-sm font-semibold text-white">Try again</Text>
        </Pressable>
      </View>
    );
  }

  // Empty state (Req 4.5-style friendly message for an empty campus feed).
  if (listings.length === 0) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-base font-medium text-gray-900">
          No listings in your campus yet
        </Text>
        <Text className="mt-1 text-center text-sm text-gray-500">
          Be the first to list something for your campus community.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={listings}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ListingCard listing={item} />}
      contentContainerClassName="px-4 pt-4 pb-8"
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      ListFooterComponent={
        isFetchingNextPage ? (
          <ActivityIndicator className="my-4" color="#111827" />
        ) : null
      }
    />
  );
}
