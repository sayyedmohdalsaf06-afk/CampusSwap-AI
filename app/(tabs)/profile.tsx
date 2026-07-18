import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import {
  BarChart3,
  ChevronRight,
  ClipboardList,
  Heart,
  Leaf,
  MessageCircle,
  Settings,
  Sparkles,
} from "lucide-react-native";

import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { Skeleton } from "@/components/Skeleton";
import { ListingCardSkeleton } from "@/components/Skeletons";
import { StatCard } from "@/components/StatCard";
import { useMyListings } from "@/hooks/useListings";
import { supabase } from "@/lib/supabase";
import { colors, gradients, shadows } from "@/lib/theme";
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
 *
 * Reskinned to the design system: green gradient hero with avatar initials,
 * soft-shadowed StatCards, and design-system loading / error / empty states.
 */
export default function ProfileScreen() {
  const profile = useAuthStore((s) => s.profile);

  // No-profile placeholder — auth is paused; this is the graceful state.
  if (!profile) {
    return (
      <View className="flex-1 bg-bg">
        <EmptyState
          icon="👤"
          title="Sign in to view your profile"
          subtitle="Your campus, impact, and listings will appear here once you're signed in."
        />
      </View>
    );
  }

  return <ProfileContent profile={profile} />;
}

/** Derive up-to-two-letter initials from a display name for the hero avatar. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Renders the profile for a present (non-null) student profile. Split out so
 * hooks below run unconditionally against a guaranteed profile.
 */
function ProfileContent({ profile }: { profile: Profile }) {
  const router = useRouter();

  const [campusName, setCampusName] = useState<string | null>(null);
  const [campusLoading, setCampusLoading] = useState(false);

  const {
    data: listings,
    isLoading,
    isError,
    refetch,
  } = useMyListings(profile.id);

  // Resolve the assigned campus name for the header — same pattern as the feed
  // header (design §4.2). Shows a skeleton while loading, "—" when unassigned.
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
      className="flex-1 bg-bg"
      data={listings ?? []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ListingCard listing={item} />}
      contentContainerClassName="px-4 pb-8"
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <View>
          {/* Deep-navy gradient hero: avatar initials, name, email, campus. */}
          <LinearGradient
            colors={gradients.brandNavy as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[shadows.card, { borderRadius: 20 }]}
            className="mt-14 overflow-hidden rounded-card p-5"
          >
            <View className="flex-row items-start justify-between">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-white/20">
                <Text className="text-xl font-jakartaExtrabold text-white">
                  {initialsOf(displayName)}
                </Text>
              </View>
              {/* Settings entry point → stack route "/settings". */}
              <Pressable
                onPress={() => router.push("/settings")}
                accessibilityRole="button"
                accessibilityLabel="Open settings"
                className="h-10 w-10 items-center justify-center rounded-2xl bg-white/20 active:opacity-70"
              >
                <Settings size={20} color="#ffffff" />
              </Pressable>
            </View>

            <Text
              className="mt-4 text-2xl font-jakartaExtrabold text-white"
              numberOfLines={1}
            >
              {displayName}
            </Text>
            <Text className="mt-0.5 text-sm font-jakarta text-white/85" numberOfLines={1}>
              {profile.email}
            </Text>

            <View className="mt-3 flex-row items-center">
              <Text className="text-xs font-jakartaMedium uppercase tracking-wide text-white/70">
                Campus
              </Text>
              {campusLoading ? (
                <Skeleton width={96} height={12} className="ml-1" />
              ) : (
                <Text className="ml-1 text-xs font-jakartaSemibold text-white/90">
                  {campusName ?? "—"}
                </Text>
              )}
            </View>
          </LinearGradient>

          {/* Stats row: points + carbon saved (Req 6.4, 6.6, 14.8) */}
          <View className="flex-row gap-3 py-5">
            <StatCard
              label="Points earned"
              value={String(profile.points)}
              icon={<Sparkles size={14} color={colors.primaryDark} />}
            />
            <StatCard
              label="Carbon saved"
              value={formatCarbonKg(profile.cumulative_carbon_g)}
              caption="CO₂e · directional estimate"
              icon={<Leaf size={14} color={colors.primaryDark} />}
            />
          </View>

          {/* Quick actions — entry points to the frontend My Reservations +
              Wishlist stack routes. */}
          <View className="pb-5">
            <QuickAction
              icon={<ClipboardList size={18} color={colors.primaryDark} />}
              label="My Reservations"
              onPress={() => router.push("/reservations")}
            />
            <View className="h-3" />
            <QuickAction
              icon={<Heart size={18} color={colors.primaryDark} />}
              label="Wishlist"
              onPress={() => router.push("/wishlist")}
            />
            <View className="h-3" />
            <QuickAction
              icon={<MessageCircle size={18} color={colors.primaryDark} />}
              label="Messages"
              onPress={() => router.push("/chat")}
            />
            <View className="h-3" />
            <QuickAction
              icon={<Leaf size={18} color={colors.primaryDark} />}
              label="Sustainability"
              onPress={() => router.push("/sustainability")}
            />
            <View className="h-3" />
            <QuickAction
              icon={<BarChart3 size={18} color={colors.primaryDark} />}
              label="Leaderboard"
              onPress={() => router.push("/leaderboard")}
            />
          </View>

          {/* My listings heading (Req 7.2) */}
          <Text className="pb-3 text-lg font-jakartaBold text-ink">
            My listings
          </Text>
        </View>
      }
      ListEmptyComponent={
        <MyListingsBody
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          onCreate={() => router.push("/listing/create")}
        />
      }
    />
  );
}

type MyListingsBodyProps = {
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onCreate: () => void;
};

/**
 * Loading / error / empty states for the "My listings" section. Only rendered
 * (via ListEmptyComponent) when there are no listings to show.
 */
function MyListingsBody({
  isLoading,
  isError,
  onRetry,
  onCreate,
}: MyListingsBodyProps) {
  // Initial-load skeletons — ListingCard-shaped placeholders (Req 8.1).
  if (isLoading) {
    return (
      <View>
        {[0, 1].map((i) => (
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
        title="We couldn't load your listings."
        subtitle="Something went wrong while fetching your listings."
        action={{ label: "Try again", onPress: onRetry }}
      />
    );
  }

  // Empty state (Req 7.2 — no listings yet).
  return (
    <EmptyState
      icon="🪧"
      title="You haven't listed anything yet."
      subtitle="Tap below to list your first item and start swapping."
      action={{ label: "Create a listing", onPress: onCreate }}
    />
  );
}

type QuickActionProps = {
  icon: ReactNode;
  label: string;
  onPress: () => void;
};

/** Rounded surface row with a leading icon, label, and trailing chevron. */
function QuickAction({ icon, label, onPress }: QuickActionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={shadows.soft}
      className="flex-row items-center rounded-2xl bg-surface px-4 py-3.5 active:opacity-80"
    >
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-green-50">
        {icon}
      </View>
      <Text className="text-sm font-jakartaSemibold text-ink">{label}</Text>
      <View className="ml-auto">
        <ChevronRight size={20} color={colors.subtle} />
      </View>
    </Pressable>
  );
}
