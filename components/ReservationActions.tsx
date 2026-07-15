import { Text, View } from "react-native";
import {
  CheckCircle2,
  Clock,
  Lock,
  PackageCheck,
  UserCheck,
} from "lucide-react-native";

import { PrimaryButton } from "@/components/PrimaryButton";
import {
  useActiveReservation,
  useComplete,
  useRelease,
  useReserve,
} from "@/hooks/useReservation";
import { useAuthStore } from "@/stores/authStore";
import type { ListingWithImages } from "@/types";

/**
 * Reservation actions for the listing detail (design §4.2 `listing/[id].tsx`,
 * §1.6 Flow 6; Req 13.1–13.8, 4.6). Rendered below <ListingDetail />. Behavior
 * is driven by `listing.status`, the acting `profile`, and the active
 * reservation:
 *
 *  - Seller  → active: waiting note · reserved: reserver + complete/release ·
 *              sold/donated: completed label.
 *  - Buyer   → active: Reserve · reserved (own): "You reserved this" + Release ·
 *              reserved (other): unavailable · sold/donated: no longer available.
 *
 * Reserving is a pickup-intent signal only — there is NO price/payment UI
 * (Req 13.4); an "arrange handoff offline" note is always shown for live states.
 *
 * // TODO(auth): the acting user comes from `useAuthStore().profile` (future
 * // authenticated verified profile). When `profile` is null we render a
 * // guidance state and never fabricate a user or crash.
 */
type ReservationActionsProps = {
  listing: ListingWithImages;
};

/** Small rounded info panel wrapper for a status/message block. */
function InfoPanel({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
      {children}
    </View>
  );
}

/** The always-on "coordinate offline" note (facilitate-only, Req 13.4, 5.3). */
function OfflineNote() {
  return (
    <Text className="mt-3 text-xs leading-5 text-gray-400">
      No payments in-app — reserving only signals pickup intent. Arrange the
      handoff offline.
    </Text>
  );
}

/** Extract a user-facing message from a mutation error (e.g. "already reserved"). */
function errorMessage(error: Error | null): string | null {
  return error ? error.message : null;
}

export function ReservationActions({ listing }: ReservationActionsProps) {
  const profile = useAuthStore((s) => s.profile);
  const { data: reservation, isLoading: reservationLoading } =
    useActiveReservation(listing.id);

  const reserve = useReserve();
  const release = useRelease();
  const complete = useComplete();

  const status = listing.status;

  // ── Unauthenticated / no profile: guidance only, never crash (TODO(auth)) ──
  if (!profile) {
    return (
      <View className="border-t border-gray-100 px-5 pt-5">
        <InfoPanel>
          <View className="flex-row items-center">
            <Lock size={18} color="#6b7280" />
            <Text className="ml-2 text-sm font-medium text-gray-600">
              Sign in to reserve
            </Text>
          </View>
          <Text className="mt-1 text-xs leading-5 text-gray-400">
            Verify your campus email to reserve items and coordinate pickup.
          </Text>
        </InfoPanel>
      </View>
    );
  }

  const isSeller = profile.id === listing.seller_id;
  const isOwnReservation = reservation?.buyer_id === profile.id;
  const reserverLabel =
    reservation?.buyer?.display_name ||
    reservation?.buyer?.email ||
    "A campus buyer";

  const reserveError = errorMessage(reserve.error);
  const releaseError = errorMessage(release.error);
  const completeError = errorMessage(complete.error);

  return (
    <View className="border-t border-gray-100 px-5 pt-5">
      {/* ─────────────────────────── SELLER VIEW ─────────────────────────── */}
      {isSeller ? (
        <>
          {status === "active" ? (
            <InfoPanel>
              <View className="flex-row items-center">
                <Clock size={18} color="#6b7280" />
                <Text className="ml-2 text-sm font-medium text-gray-600">
                  Waiting for a buyer to reserve
                </Text>
              </View>
              <Text className="mt-1 text-xs leading-5 text-gray-400">
                Your item is live in the campus feed.
              </Text>
            </InfoPanel>
          ) : null}

          {status === "reserved" ? (
            <View className="gap-3">
              <InfoPanel>
                <View className="flex-row items-center">
                  <UserCheck size={18} color="#b45309" />
                  <Text className="ml-2 text-sm font-semibold text-amber-700">
                    Reserved
                  </Text>
                </View>
                <Text className="mt-1 text-sm text-gray-700">
                  {reservationLoading
                    ? "Loading reservation…"
                    : `Reserved by ${reserverLabel}`}
                </Text>
              </InfoPanel>

              <Text className="text-sm font-semibold text-gray-700">
                Complete the exchange
              </Text>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <PrimaryButton
                    label="Mark as sold"
                    icon={<PackageCheck size={18} color="#ffffff" />}
                    loading={
                      complete.isPending &&
                      complete.variables?.outcome === "sold"
                    }
                    disabled={!reservation || complete.isPending}
                    onPress={() => {
                      if (!reservation) return;
                      complete.mutate({
                        reservationId: reservation.id,
                        listingId: listing.id,
                        outcome: "sold",
                      });
                    }}
                  />
                </View>
                <View className="flex-1">
                  <PrimaryButton
                    label="Mark as donated"
                    variant="outline"
                    loading={
                      complete.isPending &&
                      complete.variables?.outcome === "donated"
                    }
                    disabled={!reservation || complete.isPending}
                    onPress={() => {
                      if (!reservation) return;
                      complete.mutate({
                        reservationId: reservation.id,
                        listingId: listing.id,
                        outcome: "donated",
                      });
                    }}
                  />
                </View>
              </View>

              <PrimaryButton
                label="Release reservation"
                variant="outline"
                loading={release.isPending}
                disabled={!reservation || release.isPending}
                onPress={() => {
                  if (!reservation) return;
                  release.mutate({
                    reservationId: reservation.id,
                    listingId: listing.id,
                  });
                }}
              />

              {completeError ? (
                <Text className="text-sm text-red-600">{completeError}</Text>
              ) : null}
              {releaseError ? (
                <Text className="text-sm text-red-600">{releaseError}</Text>
              ) : null}
              <OfflineNote />
            </View>
          ) : null}

          {status === "sold" || status === "donated" ? (
            <InfoPanel>
              <View className="flex-row items-center">
                <CheckCircle2 size={18} color="#15803d" />
                <Text className="ml-2 text-sm font-semibold text-green-700">
                  {status === "sold"
                    ? "Marked as sold"
                    : "Marked as donated"}
                </Text>
              </View>
              <Text className="mt-1 text-xs leading-5 text-gray-400">
                This listing is closed. The conversation is preserved.
              </Text>
            </InfoPanel>
          ) : null}
        </>
      ) : (
        /* ─────────────────────────── BUYER VIEW ─────────────────────────── */
        <>
          {status === "active" ? (
            <View className="gap-2">
              <PrimaryButton
                label="Reserve"
                loading={reserve.isPending}
                disabled={reserve.isPending}
                onPress={() =>
                  reserve.mutate({
                    listingId: listing.id,
                    buyerId: profile.id,
                    // TODO(auth): campus comes from the verified profile; RLS
                    // also enforces campus + active-listing on insert.
                    campusId: profile.campus_id as string,
                  })
                }
              />
              {reserveError ? (
                <Text className="text-sm text-red-600">{reserveError}</Text>
              ) : null}
              <OfflineNote />
            </View>
          ) : null}

          {status === "reserved" && isOwnReservation ? (
            <View className="gap-3">
              <InfoPanel>
                <View className="flex-row items-center">
                  <CheckCircle2 size={18} color="#15803d" />
                  <Text className="ml-2 text-sm font-semibold text-green-700">
                    You reserved this
                  </Text>
                </View>
                <Text className="mt-1 text-xs leading-5 text-gray-400">
                  Coordinate the handoff with the seller offline.
                </Text>
              </InfoPanel>
              <PrimaryButton
                label="Release reservation"
                variant="outline"
                loading={release.isPending}
                disabled={!reservation || release.isPending}
                onPress={() => {
                  if (!reservation) return;
                  release.mutate({
                    reservationId: reservation.id,
                    listingId: listing.id,
                  });
                }}
              />
              {releaseError ? (
                <Text className="text-sm text-red-600">{releaseError}</Text>
              ) : null}
            </View>
          ) : null}

          {status === "reserved" && !isOwnReservation ? (
            <InfoPanel>
              <View className="flex-row items-center">
                <Lock size={18} color="#b45309" />
                <Text className="ml-2 text-sm font-semibold text-amber-700">
                  Reserved
                </Text>
              </View>
              <Text className="mt-1 text-xs leading-5 text-gray-400">
                Someone is already picking this up. Check back if it frees up.
              </Text>
            </InfoPanel>
          ) : null}

          {status === "sold" || status === "donated" ? (
            <InfoPanel>
              <View className="flex-row items-center">
                <Lock size={18} color="#6b7280" />
                <Text className="ml-2 text-sm font-semibold text-gray-600">
                  No longer available
                </Text>
              </View>
              <Text className="mt-1 text-xs leading-5 text-gray-400">
                This item has been {status}.
              </Text>
            </InfoPanel>
          ) : null}
        </>
      )}
    </View>
  );
}

export default ReservationActions;
