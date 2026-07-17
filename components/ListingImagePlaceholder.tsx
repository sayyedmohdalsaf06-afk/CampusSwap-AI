import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  Bike,
  BookOpen,
  Lamp,
  Laptop,
  Package,
  Sofa,
  type LucideIcon,
} from "lucide-react-native";

import { colors } from "@/lib/theme";

/**
 * Category → visual treatment for the demo-image placeholder. Each entry pairs
 * a lucide icon with a soft two-tone gradient (a gentle category tint fading to
 * white) and an accent color for the icon. Green is kept intentionally minimal
 * — reserved for sustainability-leaning categories (cycles) — so the overall
 * feel stays white / deep-navy / violet per the premium design direction.
 */
type CategoryStyle = {
  icon: LucideIcon;
  /** Gradient tint stop (fades to white) behind the icon badge. */
  tintBg: string;
  /** Accent color for the icon glyph. */
  accent: string;
};

const CATEGORY_STYLES: Record<string, CategoryStyle> = {
  books: { icon: BookOpen, tintBg: colors.blue.bg, accent: colors.blue.base },
  electronics: {
    icon: Laptop,
    tintBg: colors.violet.bg,
    accent: colors.violet.base,
  },
  furniture: { icon: Sofa, tintBg: colors.amber.bg, accent: colors.amber.base },
  hostel_essentials: {
    icon: Lamp,
    tintBg: colors.borderLight,
    accent: colors.muted,
  },
  // Green accent is acceptable here — cycles lean sustainability.
  cycles: { icon: Bike, tintBg: colors.green[50], accent: colors.primary },
};

const DEFAULT_STYLE: CategoryStyle = {
  icon: Package,
  tintBg: colors.borderLight,
  accent: colors.subtle,
};

/** Human-friendly category names for the optional caption. */
const CATEGORY_LABELS: Record<string, string> = {
  books: "Books",
  electronics: "Electronics",
  furniture: "Furniture",
  hostel_essentials: "Hostel essentials",
  cycles: "Cycles",
};

type ListingImagePlaceholderProps = {
  /** Raw listing category (drives icon, tint, accent, and caption). */
  category: string;
  /** Whether to render the small category caption. Defaults to true. */
  label?: boolean;
};

/**
 * Presentational, self-contained placeholder rendered whenever a listing has no
 * photo. It fills its parent and NEVER shows a broken / "No photo" state —
 * instead it paints a soft diagonal category tint → white gradient with a
 * centered category icon inside a rounded surface badge, and (optionally) a
 * muted category caption. Backend / data logic is untouched; this is UI only.
 */
export function ListingImagePlaceholder({
  category,
  label = true,
}: ListingImagePlaceholderProps) {
  const style = CATEGORY_STYLES[category] ?? DEFAULT_STYLE;
  const Icon = style.icon;
  const caption = CATEGORY_LABELS[category] ?? category;

  return (
    <LinearGradient
      colors={[style.tintBg, colors.surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      <View className="h-full w-full items-center justify-center">
        <View
          className="h-20 w-20 items-center justify-center rounded-full bg-surface"
          style={{ backgroundColor: "rgba(255,255,255,0.7)" }}
        >
          <Icon size={40} color={style.accent} />
        </View>
        {label ? (
          <Text className="mt-2 text-xs font-jakartaMedium text-muted">
            {caption}
          </Text>
        ) : null}
      </View>
    </LinearGradient>
  );
}

export default ListingImagePlaceholder;
