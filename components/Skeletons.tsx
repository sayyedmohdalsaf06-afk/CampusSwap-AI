import type { ReactNode } from "react";
import { View } from "react-native";

import { Skeleton } from "@/components/Skeleton";
import { shadows } from "@/lib/theme";

/**
 * Reusable composite skeletons (design-system foundation) built from the
 * shimmering <Skeleton/> primitive. These mirror the real components' shapes so
 * loading states feel like the content that's about to appear. Presentational
 * only — no data, auth, or routing logic lives here.
 */

/**
 * A ListingCard-shaped loading placeholder: a rounded surface card with a soft
 * shadow, a full-width cover block, then title / caption / price lines. Matches
 * `ListingCard` so feeds don't shift when real cards load. Includes `mb-3` so a
 * stack of these spaces like the real cards.
 */
export function ListingCardSkeleton() {
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

/**
 * A profile-screen placeholder: a navy-ish hero block, a row of two stat-card
 * placeholders, and a couple of list rows — echoing the profile hero + stats +
 * quick-action layout.
 */
export function ProfileSkeleton() {
  return (
    <View>
      {/* Deep-navy hero placeholder (matches the gradient hero surface). */}
      <View
        style={[shadows.card, { height: 150 }]}
        className="w-full overflow-hidden rounded-card bg-navy"
      />

      {/* Two stat-card placeholders. */}
      <View className="mt-4 flex-row gap-3">
        {[0, 1].map((i) => (
          <View
            key={i}
            style={shadows.soft}
            className="flex-1 rounded-2xl bg-surface p-4"
          >
            <Skeleton width={36} height={36} radius={999} />
            <Skeleton width="60%" height={18} className="mt-3" />
            <Skeleton width="45%" height={12} className="mt-2" />
          </View>
        ))}
      </View>

      {/* A couple of list rows. */}
      <View className="mt-4">
        <Skeleton height={56} radius={16} className="mb-3" />
        <Skeleton height={56} radius={16} />
      </View>
    </View>
  );
}

/**
 * A notification/list-row placeholder: a small circular avatar with a title and
 * subtitle line inside a soft-shadowed surface card. Includes `mb-3` for
 * stacking.
 */
export function NotificationCardSkeleton() {
  return (
    <View
      style={shadows.soft}
      className="mb-3 flex-row items-center rounded-2xl bg-surface p-4"
    >
      <Skeleton width={40} height={40} radius={999} />
      <View className="ml-3 flex-1">
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={12} className="mt-2" />
      </View>
    </View>
  );
}

/**
 * Small convenience helper — renders `count` copies of `children`. Callers can
 * also just map over an array themselves; this keeps the common case tidy.
 */
export function SkeletonList({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>{children}</View>
      ))}
    </>
  );
}
