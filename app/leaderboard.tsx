import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { ChevronLeft, Leaf, Sparkles, Trophy } from "lucide-react-native";

import { EmptyState } from "@/components/EmptyState";
import { colors, shadows } from "@/lib/theme";
import { useAuthStore } from "@/stores/authStore";
import type { Profile } from "@/types";
import { formatCarbonKg } from "@/utils/format";

/**
 * Campus Leaderboard (frontend-only stack route — NOT a tab). Shows the
 * signed-in student's own rank card (built entirely from their own profile) and
 * a graceful placeholder for the full ranked list, which is backend-pending.
 *
 * // TODO(auth): the acting user is read from `useAuthStore().profile`. Auth is
 * // paused for this slice — this screen NEVER mocks a real user. The greyed
 * // sample rows below are clearly-decorative UI hints, not real people.
 *
 * The screen intentionally does NOT attempt a cross-profile query: current RLS
 * restricts `profiles` reads to self, so a real ranked list can't be computed
 * client-side. See the TODO(backend) note by the placeholder section.
 */
export default function LeaderboardScreen() {
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
        <Text className="text-xl font-jakartaBold text-ink">Leaderboard</Text>
      </View>

      {profile ? (
        <LeaderboardContent profile={profile} />
      ) : (
        <EmptyState
          icon="🏆"
          title="Sign in to see the leaderboard"
          subtitle="Your campus rank and impact standing will appear here once you're signed in."
        />
      )}
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

/** Renders the leaderboard for a present (non-null) profile. */
function LeaderboardContent({ profile }: { profile: Profile }) {
  const displayName =
    profile.display_name ?? profile.email.split("@")[0] ?? "Student";

  // Purely-decorative sample rows to hint at the future ranked UI. These are
  // NOT real users — rendered greyed-out (opacity-40) and clearly labelled.
  const sampleRows = [
    { rank: 1, name: "Campus member", points: "—" },
    { rank: 2, name: "Campus member", points: "—" },
    { rank: 3, name: "Campus member", points: "—" },
  ];

  return (
    <ScrollView
      contentContainerClassName="px-4 pb-12 pt-1"
      showsVerticalScrollIndicator={false}
    >
      {/* Your rank card — the current user, built from their own profile. */}
      <Text className="mb-3 text-lg font-jakartaBold text-ink">Your standing</Text>
      <View style={shadows.card} className="rounded-2xl bg-surface p-4">
        <View className="flex-row items-center">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-green-50">
            <Text className="text-base font-jakartaExtrabold text-green-700">
              {initialsOf(displayName)}
            </Text>
          </View>
          <View className="ml-3 flex-1">
            <Text
              className="text-base font-jakartaBold text-ink"
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text className="text-xs font-jakartaMedium uppercase tracking-wide text-subtle">
              That's you
            </Text>
          </View>
          <View className="h-10 w-10 items-center justify-center rounded-full bg-green-50">
            <Trophy size={18} color={colors.green[600]} />
          </View>
        </View>

        <View className="mt-4 flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-borderLight px-3 py-2.5">
            <View className="flex-row items-center">
              <Sparkles size={13} color={colors.primaryDark} />
              <Text className="ml-1 text-xs font-jakartaMedium uppercase tracking-wide text-subtle">
                Points
              </Text>
            </View>
            <Text className="mt-1 text-xl font-jakartaExtrabold text-ink">
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
            <Text className="mt-1 text-xl font-jakartaExtrabold text-ink">
              {formatCarbonKg(profile.cumulative_carbon_g)}
            </Text>
          </View>
        </View>
      </View>

      {/* Full ranked list — backend-pending placeholder. */}
      <Text className="mb-3 mt-6 text-lg font-jakartaBold text-ink">
        Campus ranking
      </Text>
      <View style={shadows.soft} className="rounded-2xl bg-surface p-5">
        <View className="items-center">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-green-50">
            <Trophy size={22} color={colors.green[600]} />
          </View>
          <Text className="mt-3 text-center text-base font-jakartaSemibold text-ink">
            Campus leaderboard coming soon
          </Text>
          <Text className="mt-1 text-center text-sm font-jakarta text-muted">
            Soon you'll see how your impact ranks across your whole campus.
            We're building a fair, campus-wide ranking of points and carbon
            saved.
          </Text>
        </View>

        {/* Decorative sample rows (clearly mock, greyed at opacity-40). */}
        <View className="mt-5 gap-2 opacity-40">
          {sampleRows.map((row) => (
            <View
              key={row.rank}
              className="flex-row items-center rounded-2xl bg-borderLight px-3 py-2.5"
            >
              <Text className="w-6 text-sm font-jakartaExtrabold text-muted">
                {row.rank}
              </Text>
              <View className="ml-1 h-9 w-9 items-center justify-center rounded-full bg-surface">
                <Text className="text-xs font-jakartaBold text-subtle">--</Text>
              </View>
              <Text className="ml-3 flex-1 text-sm font-jakartaSemibold text-muted">
                {row.name}
              </Text>
              <Text className="text-sm font-jakartaSemibold text-subtle">
                {row.points}
              </Text>
            </View>
          ))}
        </View>
        <Text className="mt-3 text-center text-xs font-jakarta text-subtle">
          Sample preview — not real rankings yet.
        </Text>
        {/* TODO(backend): compute and rank campus members server-side (a
            leaderboard view/RPC); current RLS restricts profiles to self, so
            the client cannot build a real cross-user ranking. */}
      </View>
    </ScrollView>
  );
}
