import {
  Image,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gift, ImageOff } from "lucide-react-native";

import { Badge } from "@/components/Badge";
import { getListingImageUrl } from "@/lib/storage";
import { colors, shadows } from "@/lib/theme";
import type { ListingStatus, ListingWithImages } from "@/types";

/** Format a numeric price as a rupee amount (facilitate-only display). */
function formatPrice(price: number | null): string {
  if (price == null) return "";
  return `₹${Math.round(price).toLocaleString("en-IN")}`;
}

type BadgeTone = "condition" | "category" | "neutral" | "success";

/** Human-friendly label + Badge tone for a listing status pill (Req 13.5, 4.6). */
function statusPill(status: ListingStatus): { label: string; tone: BadgeTone } {
  switch (status) {
    case "active":
      return { label: "Available", tone: "success" };
    case "reserved":
      return { label: "Reserved", tone: "condition" };
    case "sold":
      return { label: "Sold", tone: "neutral" };
    case "donated":
      return { label: "Donated", tone: "neutral" };
    default:
      return { label: status, tone: "neutral" };
  }
}

type ListingDetailProps = {
  listing: ListingWithImages;
};

/** A single label / value row inside the meta card. */
function MetaRow({
  label,
  value,
  divider,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <View
      className={`flex-row items-center justify-between px-4 py-3.5 ${
        divider ? "border-b border-borderLight" : ""
      }`}
    >
      <Text className="text-sm font-jakartaMedium text-muted">{label}</Text>
      <Text className="text-sm font-jakartaSemibold text-ink">{value}</Text>
    </View>
  );
}

/**
 * Presentational listing detail (design §4.2 `listing/[id].tsx`, Req 4.6).
 * Renders images (horizontal paging gallery), a status pill, title, price /
 * Donate badge, category, condition, and description. Reskinned to the design
 * system — soft surfaces, rounded media, Plus Jakarta typography, and a meta
 * card with dividers. Reservation actions live in <ReservationActions />.
 */
export function ListingDetail({ listing }: ListingDetailProps) {
  const { width } = useWindowDimensions();
  const isDonate = listing.listing_type === "donate";
  const pill = statusPill(listing.status);
  const hasCondition = Boolean(listing.condition);
  const images = [...listing.listing_images].sort(
    (a, b) => a.display_order - b.display_order
  );

  return (
    <ScrollView
      className="flex-1 bg-bg"
      showsVerticalScrollIndicator={false}
      contentContainerClassName="pb-10"
    >
      {/* Image gallery (horizontal paging preserved) */}
      <View className="overflow-hidden rounded-b-3xl bg-surface">
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
            className="items-center justify-center bg-borderLight"
            style={{ width, height: width * 0.75 }}
          >
            <ImageOff size={38} color={colors.subtle} />
            <Text className="mt-2 text-sm font-jakarta text-subtle">
              No photos
            </Text>
          </View>
        )}
      </View>

      <View className="px-5 pt-5">
        {/* Status pill */}
        <Badge label={pill.label} tone={pill.tone} />

        <Text className="mt-3 text-2xl font-jakartaExtrabold text-ink">
          {listing.title}
        </Text>

        {/* Price or Donate badge */}
        <View className="mt-2">
          {isDonate ? (
            <View className="flex-row items-center self-start rounded-full bg-green-50 px-3 py-1.5">
              <Gift size={16} color={colors.green[600]} />
              <Text className="ml-1.5 text-sm font-jakartaSemibold text-green-700">
                Free to a good home
              </Text>
            </View>
          ) : (
            <Text className="text-2xl font-jakartaExtrabold text-primaryDark">
              {formatPrice(listing.price)}
            </Text>
          )}
        </View>

        {/* Meta card (rounded surface with dividers) */}
        <View
          style={shadows.soft}
          className="mt-5 overflow-hidden rounded-2xl bg-surface"
        >
          <MetaRow
            label="Category"
            value={listing.category}
            divider={hasCondition}
          />
          {hasCondition ? (
            <MetaRow label="Condition" value={listing.condition as string} />
          ) : null}
        </View>

        {/* Description */}
        {listing.description ? (
          <View className="mt-5">
            <Text className="mb-1.5 text-sm font-jakartaSemibold text-ink">
              Description
            </Text>
            <Text className="text-base leading-6 font-jakarta text-muted">
              {listing.description}
            </Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

export default ListingDetail;
