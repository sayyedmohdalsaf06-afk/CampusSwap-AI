import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Gift, ImageOff } from "lucide-react-native";

import { getListingImageUrl } from "@/lib/storage";
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
};

/**
 * Feed card for a single listing (design §4.2 `(tabs)/index.tsx`, Req 4.1).
 * Shows the primary image (with a graceful placeholder), title, category, and
 * either the price (`sell`) or a Donate badge (`donate`). Pressing it navigates
 * to the listing detail route.
 */
export function ListingCard({ listing }: ListingCardProps) {
  const router = useRouter();
  const cover = primaryImage(listing.listing_images);
  const isDonate = listing.listing_type === "donate";

  return (
    <Pressable
      className="mb-3 overflow-hidden rounded-2xl border border-gray-200 bg-white active:opacity-90"
      onPress={() => router.push(`/listing/${listing.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`View ${listing.title}`}
    >
      <View className="aspect-[4/3] w-full items-center justify-center bg-gray-100">
        {cover ? (
          <Image
            source={{ uri: getListingImageUrl(cover.storage_path) }}
            className="h-full w-full"
            resizeMode="cover"
          />
        ) : (
          <View className="items-center">
            <ImageOff size={28} color="#9ca3af" />
            <Text className="mt-1 text-xs text-gray-400">No photo</Text>
          </View>
        )}
      </View>

      <View className="p-3">
        <Text
          className="text-base font-semibold text-gray-900"
          numberOfLines={1}
        >
          {listing.title}
        </Text>
        <Text className="mt-0.5 text-xs uppercase tracking-wide text-gray-400">
          {listing.category}
        </Text>

        <View className="mt-2">
          {isDonate ? (
            <View className="flex-row items-center self-start rounded-full bg-green-100 px-2.5 py-1">
              <Gift size={13} color="#15803d" />
              <Text className="ml-1 text-xs font-semibold text-green-700">
                Donate
              </Text>
            </View>
          ) : (
            <Text className="text-lg font-bold text-gray-900">
              {formatPrice(listing.price)}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default ListingCard;
