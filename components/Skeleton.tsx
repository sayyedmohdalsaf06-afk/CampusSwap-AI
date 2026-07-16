import type { DimensionValue } from "react-native";
import { MotiView } from "moti";

import { colors } from "@/lib/theme";

/**
 * Subtle pulsing placeholder (design-system foundation). Used to fill space
 * while content loads. Animates opacity in a loop via Moti (already a project
 * dependency).
 */
type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  className?: string;
};

export function Skeleton({
  width = "100%",
  height = 16,
  radius = 8,
  className,
}: SkeletonProps) {
  return (
    <MotiView
      from={{ opacity: 0.5 }}
      animate={{ opacity: 1 }}
      transition={{
        loop: true,
        type: "timing",
        duration: 800,
        // keeps the pulse smooth and non-distracting
      }}
      className={className}
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: colors.borderLight,
      }}
    />
  );
}

export default Skeleton;
