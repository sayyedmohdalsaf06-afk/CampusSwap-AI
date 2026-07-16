import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronLeft, Leaf, Sparkles } from "lucide-react-native";

import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { StatCard } from "@/components/StatCard";
import { useMyListings } from "@/hooks/useListings";
import { colors, gradients, shadows } from "@/lib/theme";
import { useAuthStore } from "@/stores/authStore";
import type { ListingWithImages, Profile } from "@/types";
import { formatCarbonKg } from "@/utils/format";

/**
 * Sustainability Dashboard (frontend-only stack route — NOT a tab). Surfaces
 * the signed-in student's personal environmental impact using ONLY data we
 * already have: the profile's cumulative carbon + points, and their own
 * listings (via `useMyListings`) for derived counts + a lightweight impact
 * breakdown.
 *
 * // TODO(auth): the acting user is read from `useAuthStore().profile`. Auth is
 * // intentionally paused for this slice — this screen NEVER mocks a user. When
 * // `profile` is null we render a graceful "sign in" placeholder.
 *
 * Campus-wide aggregates are backend-pending — see the "Campus impact"
 * placeholder card and its TODO(backend) note.
 */
export default function SustainabilityScreen() {
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
        <Text className="text-xl font-jakartaBold text-ink">Sustainability</Text>
      </View>

      {profile ? (
        <SustainabilityContent profile={profile} />
      ) : (
        <EmptyState
          icon="🌱"
          title="Sign in to see your impact"
          subtitle="Your carbon saved, points, and listing impact will appear here once you're signed in."
        />
      )}
    </View>
  );
}

/** Renders the dashboard for a present (non-null) profile. */
function SustainabilityContent({ profile }: { profile: Profile }) {
  const { data: listings, isLoading } = useMyListings(profile.id);
  const all = listings ?? [];

  // Derived counts from EXISTING personal listing data.
  const total = all.length;
  const activeCount = countBy(all, "active");
  const soldCount = countBy(all, "sold");
  const donatedCount = countBy(all, "donated");
  const reservedCount = countBy(all, "reserved");
  // "Second life" = items that left the shelf as sold or donated.
  const secondLife = soldCount + donatedCount;

  return (
    <ScrollView
      contentContainerClassName="px-4 pb-12 pt-1"
      showsVerticalScrollIndicator={false}
    >
      {/* Green gradient hero — headline carbon saved + points. */}
      <LinearGradient
        colors={gradients.greenBanner as unknown as [string, string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[shadows.card, { borderRadius: 20 }]}
        className="overflow-hidden rounded-card p-5"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 pr-3">
            <Text className="text-xs font-jakartaMedium uppercase tracking-wide text-white/70">
              Carbon saved
            </Text>
            <Text className="mt-1 text-4xl font-jakartaExtrabold text-white">
              {formatCarbonKg(profile.cumulative_carbon_g)}
            </Text>
            <Text className="mt-1 text-sm font-jakarta text-white/85">
              CO₂e kept out of the air by swapping instead of shopping. Every
              reuse counts — keep it up! 🌍
            </Text>
          </View>
          <View className="h-14 w-14 items-center justify-center rounded-full bg-white/20">
            <Leaf size={26} color="#ffffff" />
          </View>
        </View>

        <View className="mt-4 flex-row items-center rounded-2xl bg-white/15 px-4 py-3">
          <Sparkles size={16} color="#ffffff" />
          <Text className="ml-2 text-sm font-jakartaSemibold text-white">
            {profile.points} points earned
          </Text>
        </View>
      </LinearGradient>

      {/* Personal stats grid (derived from existing data). */}
      <Text className="mb-3 mt-6 text-lg font-jakartaBold text-ink">
        Your impact
      </Text>

      {isLoading ? (
        <View className="gap-3">
          <View className="flex-row gap-3">
            <StatSkeleton />
            <StatSkeleton />
          </View>
          <View className="flex-row gap-3">
            <StatSkeleton />
            <StatSkeleton />
          </View>
        </View>
      ) : (
        <View className="gap-3">
          <View className="flex-row gap-3">
            <StatCard
              label="Carbon saved"
              value={formatCarbonKg(profile.cumulative_carbon_g)}
              caption="CO₂e · directional estimate"
              icon={<Leaf size={14} color={colors.primaryDark} />}
            />
            <StatCard
              label="Points"
              value={String(profile.points)}
              icon={<Sparkles size={14} color={colors.primaryDark} />}
            />
          </View>
          <View className="flex-row gap-3">
            <StatCard label="Items listed" value={String(total)} />
            <StatCard
              label="Second life"
              value={String(secondLife)}
              caption="sold or donated"
            />
          </View>
        </View>
      )}

      {/* Impact breakdown — lightweight bar rows (plain Views, no chart lib). */}
      <Text className="mb-3 mt-6 text-lg font-jakartaBold text-ink">
        Listing breakdown
      </Text>
      <View style={shadows.soft} className="rounded-2xl bg-surface p-4">
        {isLoading ? (
          <View className="gap-4">
            <Skeleton width="100%" height={14} />
            <Skeleton width="100%" height={14} />
            <Skeleton width="100%" height={14} />
          </View>
        ) : total === 0 ? (
          <Text className="py-2 text-center text-sm font-jakarta text-muted">
            List an item to start tracking your impact here.
          </Text>
        ) : (
          <View className="gap-4">
            <BarRow
              label="Active"
              count={activeCount}
              total={total}
              color={colors.primary}
            />
            <BarRow
              label="Reserved"
              count={reservedCount}
              total={total}
              color={colors.amber.base}
            />
            <BarRow
              label="Sold"
              count={soldCount}
              total={total}
              color={colors.blue.base}
            />
            <BarRow
              label="Donated"
              count={donatedCount}
              total={total}
              color={colors.green[600]}
            />
          </View>
        )}
      </View>

      {/* Campus impact — backend-pending placeholder. */}
      <Text className="mb-3 mt-6 text-lg font-jakartaBold text-ink">
        Campus impact
      </Text>
      <View
        style={shadows.soft}
        className="items-center rounded-2xl bg-surface px-5 py-8"
      >
        <View className="h-12 w-12 items-center justify-center rounded-full bg-green-50">
          <Leaf size={22} color={colors.green[600]} />
        </View>
        <Text className="mt-3 text-center text-base font-jakartaSemibold text-ink">
          Campus-wide impact coming soon
        </Text>
        <Text className="mt-1 text-center text-sm font-jakarta text-muted">
          We're totting up how much your whole campus has saved together. Check
          back soon to see the community's collective footprint.
        </Text>
        {/* TODO(backend): aggregate campus-level carbon/points server-side (a
            view or RPC). The client intentionally does NOT attempt a
            cross-user aggregate query that current RLS would restrict. */}
      </View>

      {/* Educational footer note (Req 6.6). */}
      <Text className="mt-5 px-1 text-center text-xs font-jakarta text-subtle">
        Carbon figures are directional estimates based on typical category
        savings, shown to encourage reuse — not exact measurements.
      </Text>
    </ScrollView>
  );
}

/** Count listings in a given status. */
function countBy(listings: ListingWithImages[], status: string): number {
  return listings.filter((l) => l.status === status).length;
}

type BarRowProps = {
  label: string;
  count: number;
  total: number;
  color: string;
};

/**
 * A single horizontal bar row built from plain Views (NO chart library). Width
 * is the relative share of `total`; robust when counts are 0.
 */
function BarRow({ label, count, total, color }: BarRowProps) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View>
      <View className="mb-1.5 flex-row items-center justify-between">
        <Text className="text-sm font-jakartaMedium text-muted">{label}</Text>
        <Text className="text-sm font-jakartaSemibold text-ink">{count}</Text>
      </View>
      <View className="h-2.5 overflow-hidden rounded-full bg-borderLight">
        <View
          style={{ width: `${pct}%`, backgroundColor: color }}
          className="h-full rounded-full"
        />
      </View>
    </View>
  );
}

/** StatCard-shaped loading placeholder. */
function StatSkeleton() {
  return (
    <View style={shadows.soft} className="flex-1 rounded-2xl bg-surface p-4">
      <Skeleton width="60%" height={12} />
      <Skeleton width="40%" height={22} className="mt-2" />
    </View>
  );
}
