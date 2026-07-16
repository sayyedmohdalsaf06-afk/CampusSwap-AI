import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Gift, ImageOff } from "lucide-react-native";

import { Button } from "@/components/Button";
import { getListingImageUrl } from "@/lib/storage";
import { colors, shadows } from "@/lib/theme";
import type { ListingImage, ListingWithImages } from "@/types";

/**
 * Pick a listing's primary image (lowest `display_order`) so the card and feed
 * consistently show the cover image (design §1.6 Flow 4 — images come from the
 * `listing_images` relationship).
 */
function primaryImage(images: ListingImage[]): ListingImage | null {
  if (images.length === 0) return null;
  return [...images].sort((a, b) => a.display_order - b.display_order)[0];
}

/** Format a numeric price as a rupee amount (facilitate-only display; Req 4.1). */
function formatPrice(price: number | null): string {
  if (price == null) return "";
  return `₹${Math.round(price).toLocaleString("en-IN")}`;
}

type ListingCardProps = {
  listing: ListingWithImages;
  /** Optional press override. Defaults to navigating to the listing detail. */
  onPress?: () => void;
  /** Optional reserve action — renders a compact reserve button when provided. */
  onReserve?: () => void;
};

/**
 * Feed card for a single listing (design §4.2 `(tabs)/index.tsx`, Req 4.1).
 * Reskinned to the design system: rounded card surface, 4:3 cover image with a
 * graceful placeholder, one-line title, category caption, and either a bold
 * green price (`sell`) or a green Donate pill (`donate`), with a soft shadow
 * and a subtle press scale.
 *
 * Props are backward compatible: passing only `listing` preserves the original
 * tap-to-detail behavior used by the existing Feed / Search / Profile screens.
 */
export function ListingCard({ listing, onPress, onReserve }: ListingCardProps) {
  const router = useRouter();
  const cover = primaryImage(listing.listing_images);
  const isDonate = listing.listing_type === "donate";

  const handlePress =
    onPress ?? (() => router.push(`/listing/${listing.id}`));

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`View ${listing.title}`}
      style={({ pressed }) => [
        shadows.card,
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
      className="mb-3 overflow-hidden rounded-card bg-surface"
    >
      <View className="aspect-[4/3] w-full items-center justify-center bg-borderLight">
        {cover ? (
          <Image
            source={{ uri: getListingImageUrl(cover.storage_path) }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <View className="items-center">
            <ImageOff size={28} color={colors.subtle} />
            <Text className="mt-1 text-xs font-jakarta text-subtle">No photo</Text>
          </View>
        )}
      </View>

      <View className="p-4">
        <Text
          className="text-base font-jakartaBold text-ink"
          numberOfLines={1}
        >
          {listing.title}
        </Text>
        <Text className="mt-0.5 text-xs font-jakartaMedium uppercase tracking-wide text-subtle">
          {listing.category}
        </Text>

        <View className="mt-3 flex-row items-center justify-between">
          {isDonate ? (
            <View className="flex-row items-center self-start rounded-full bg-green-50 px-2.5 py-1">
              <Gift size={13} color={colors.green[600]} />
              <Text className="ml-1 text-xs font-jakartaSemibold text-green-700">
                Donate
              </Text>
            </View>
          ) : (
            <Text className="text-lg font-jakartaExtrabold text-primaryDark">
              {formatPrice(listing.price)}
            </Text>
          )}

          {onReserve ? (
            <Button label="Reserve" size="md" onPress={onReserve} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default ListingCard;
