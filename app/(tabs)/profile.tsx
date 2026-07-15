import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";

import { ListingCard } from "@/components/ListingCard";
import { StatCard } from "@/components/StatCard";
import { useMyListings } from "@/hooks/useListings";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import type { Profile } from "@/types";
import { formatCarbonKg } from "@/utils/format";

/**
 * Profile screen (design §4.2 `(tabs)/profile.tsx`; Req 7.1 campus + cumulative
 * carbon, 7.2 own listings, 6.4 cumulative carbon, points display).
 *
 * // TODO(auth): the acting user is read from `useAuthStore().profile`, which
 * // assumes the FUTURE authenticated, verified-student profile object. Auth
 * // is intentionally paused for this slice — this screen NEVER mocks or
 * // fabricates a user. When `profile` is null we render a graceful "sign in"
 * // placeholder instead of crashing.
 */
export default function ProfileScreen() {
  const profile = useAuthStore((s) => s.profile);

  // No-profile placeholder — auth is paused; this is the graceful state.
  if (!profile) {
    return (
      <View className="flex-1 items-center justify-center bg-white px-8">
        <Text className="text-center text-base font-medium text-gray-900">
          Sign in to view your profile
        </Text>
        <Text className="mt-1 text-center text-sm text-gray-500">
          Your campus, impact, and listings will appear here once you're signed
          in.
        </Text>
      </View>
    );
  }

  return <ProfileContent profile={profile} />;
}

/**
 * Renders the profile for a present (non-null) student profile. Split out so
 * hooks below run unconditionally against a guaranteed profile.
 */
function ProfileContent({ profile }: { profile: Profile }) {
  const [campusName, setCampusName] = useState<string | null>(null);
  const [campusLoading, setCampusLoading] = useState(false);

  const {
    data: listings,
    isLoading,
    isError,
    refetch,
  } = useMyListings(profile.id);

  // Resolve the assigned campus name for the header — same pattern as the feed
  // header (design §4.2). Shows a spinner while loading, "—" when unassigned.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!profile.campus_id) {
        if (active) {
          setCampusName(null);
          setCampusLoading(false);
        }
        return;
      }
      if (active) setCampusLoading(true);
      const { data: campus } = await supabase
        .from("campuses")
        .select("name")
        .eq("id", profile.campus_id)
        .maybeSingle();
      if (!active) return;
      setCampusName((campus?.name as string | undefined) ?? null);
      setCampusLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [profile.campus_id]);

  // Display name falls back to the email's local part when unset (Req 7.1).
  const displayName =
    profile.display_name ?? profile.email.split("@")[0] ?? "Student";

  return (
    <FlatList
      className="flex-1 bg-white"
      data={listings ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ListingCard listing={item} />}
      contentContainerClassName="px-4 pb-8"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View>
          {/* Identity */}
          <View className="border-b border-gray-100 px-1 pb-5 pt-14">
            <Text className="text-2xl font-bold text-gray-900">
              {displayName}
            </Text>
            <Text className="mt-0.5 text-sm text-gray-500">
              {profile.email}
            </Text>
            <View className="mt-2 flex-row items-center">
              <Text className="text-xs uppercase tracking-wide text-gray-400">
                Campus:
              </Text>
              {campusLoading ? (
                <ActivityIndicator className="ml-2" size="small" color="#111827" />
              ) : (
                <Text className="ml-2 text-sm font-semibold text-gray-900">
                  {campusName ?? "—"}
                </Text>
              )}
            </View>
          </View>

          {/* Stats row: points + carbon saved (Req 6.4, 6.6, 14.8) */}
          <View className="flex-row gap-3 px-1 py-5">
            <StatCard label="Points earned" value={String(profile.points)} />
            <StatCard
              label="Carbon saved"
              value={formatCarbonKg(profile.cumulative_carbon_g)}
              caption="CO₂e · directional estimate"
            />
          </View>

          {/* My listings heading (Req 7.2) */}
          <Text className="px-1 pb-3 text-lg font-bold text-gray-900">
            My listings
          </Text>
        </View>
      }
      ListEmptyComponent={
        <MyListingsBody
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
        />
      }
    />
  );
}

type MyListingsBodyProps = {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
};

/**
 * Loading / error / empty states for the "My listings" section. Only rendered
 * (via ListEmptyComponent) when there are no listings to show.
 */
function MyListingsBody({ isLoading, isError, onRetry }: MyListingsBodyProps) {
  // Initial-load spinner (Req 8.1-style).
  if (isLoading) {
    return (
      <View className="items-center justify-center py-12">
        <ActivityIndicator color="#111827" />
      </View>
    );
  }

  // Error + retry state.
  if (isError) {
    return (
      <View className="items-center justify-center px-6 py-12">
        <Text className="text-center text-base text-gray-700">
          We couldn't load your listings.
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

  // Empty state (Req 7.2 — no listings yet).
  return (
    <View className="items-center justify-center px-6 py-12">
      <Text className="text-center text-base font-medium text-gray-900">
        You haven't listed anything yet.
      </Text>
      <Text className="mt-1 text-center text-sm text-gray-500">
        Tap the + on your feed to list your first item.
      </Text>
    </View>
  );
}
