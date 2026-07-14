import {
  Image,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gift, ImageOff } from "lucide-react-native";

import { getListingImageUrl } from "@/lib/storage";
import type { ListingStatus, ListingWithImages } from "@/types";

/** Format a numeric price as a rupee amount (facilitate-only display). */
function formatPrice(price: number | null): string {
  if (price == null) return "";
  return `₹${Math.round(price).toLocaleString("en-IN")}`;
}

/** Human-friendly label + tone for a listing status pill (Req 13.5, 4.6). */
function statusPill(status: ListingStatus): { label: string; className: string } {
  switch (status) {
    case "active":
      return { label: "Available", className: "bg-green-100 text-green-700" };
    case "reserved":
      return { label: "Reserved", className: "bg-amber-100 text-amber-700" };
    case "sold":
      return { label: "Sold", className: "bg-gray-200 text-gray-600" };
    case "donated":
      return { label: "Donated", className: "bg-gray-200 text-gray-600" };
    default:
      return { label: status, className: "bg-gray-200 text-gray-600" };
  }
}

type ListingDetailProps = {
  listing: ListingWithImages;
};

/**
 * Presentational listing detail (design §4.2 `listing/[id].tsx`, Req 4.6).
 * Renders images (horizontal scroll), title, price/Donate badge, category,
 * condition, description, and a status pill. Reservation and contact actions
 * are intentionally NOT here — they are added by later tasks (9.3 / messaging).
 */
export function ListingDetail({ listing }: ListingDetailProps) {
  const { width } = useWindowDimensions();
  const isDonate = listing.listing_type === "donate";
  const pill = statusPill(listing.status);
  const images = [...listing.listing_images].sort(
    (a, b) => a.display_order - b.display_order
  );

  return (
    <ScrollView className="flex-1 bg-white" contentContainerClassName="pb-10">
      {/* Image gallery */}
      {images.length > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
        >
          {images.map((img) => (
            <Image
              key={img.id}
              source={{ uri: getListingImageUrl(img.storage_path) }}
              style={{ width, height: width * 0.75 }}
              resizeMode="cover"
            />
          ))}
        </ScrollView>
      ) : (
        <View
          className="items-center justify-center bg-gray-100"
          style={{ width, height: width * 0.75 }}
        >
          <ImageOff size={36} color="#9ca3af" />
          <Text className="mt-2 text-sm text-gray-400">No photos</Text>
        </View>
      )}

      <View className="px-5 pt-5">
        {/* Status pill */}
        <View
          className={`self-start rounded-full px-3 py-1 ${pill.className.split(" ")[0]}`}
        >
          <Text className={`text-xs font-semibold ${pill.className.split(" ")[1]}`}>
            {pill.label}
          </Text>
        </View>

        <Text className="mt-3 text-2xl font-bold text-gray-900">
          {listing.title}
        </Text>

        {/* Price or Donate badge */}
        <View className="mt-2">
          {isDonate ? (
            <View className="flex-row items-center self-start rounded-full bg-green-100 px-3 py-1.5">
              <Gift size={16} color="#15803d" />
              <Text className="ml-1.5 text-sm font-semibold text-green-700">
                Free to a good home
              </Text>
            </View>
          ) : (
            <Text className="text-2xl font-bold text-gray-900">
              {formatPrice(listing.price)}
            </Text>
          )}
        </View>

        {/* Meta rows */}
        <View className="mt-5 gap-3">
          <View className="flex-row justify-between border-b border-gray-100 pb-3">
            <Text className="text-sm text-gray-500">Category</Text>
            <Text className="text-sm font-medium text-gray-900">
              {listing.category}
            </Text>
          </View>
          {listing.condition ? (
            <View className="flex-row justify-between border-b border-gray-100 pb-3">
              <Text className="text-sm text-gray-500">Condition</Text>
              <Text className="text-sm font-medium text-gray-900">
                {listing.condition}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Description */}
        {listing.description ? (
          <View className="mt-5">
            <Text className="mb-1 text-sm font-semibold text-gray-700">
              Description
            </Text>
            <Text className="text-base leading-6 text-gray-700">
              {listing.description}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

export default ListingDetail;
