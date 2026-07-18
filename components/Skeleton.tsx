import { useEffect, useState } from "react";
import type { DimensionValue } from "react-native";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/lib/theme";

/**
 * Shimmer placeholder (design-system foundation). Used to fill space while
 * content loads. Renders a static base block and sweeps a subtle translucent
 * gradient across it left-to-right on a loop.
 *
 * The animation is a single reanimated shared value driven with
 * `withRepeat(withTiming(...linear...), -1)`; a translucent horizontal
 * `LinearGradient` (transparent → white → transparent) sits in an
 * absolutely-positioned Animated.View and is translated across the measured
 * block width, producing the classic shimmer sweep — no masked-view dependency
 * required. Props and default look are unchanged, so every existing caller
 * keeps working.
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
  // The block width is unknown up-front (it can be a %, a number, or "100%"),
  // so we measure it on layout to size the shimmer sweep in real pixels.
  const [blockWidth, setBlockWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    // Loop 0 → 1 forever; the mapped translateX turns this into a -100% → +100%
    // horizontal sweep of the translucent band across the block.
    progress.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.linear }),
      -1
    );
  }, [progress]);

  const shimmerStyle = useAnimatedStyle(() => {
    const travel = blockWidth || 0;
    return {
      // From roughly -100% to +100% of the block width.
      transform: [{ translateX: -travel + progress.value * (travel * 2) }],
    };
  });

  return (
    <View
      className={className}
      onLayout={(e) => setBlockWidth(e.nativeEvent.layout.width)}
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: colors.borderLight,
        overflow: "hidden",
      }}
    >
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.65)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

export default Skeleton;
