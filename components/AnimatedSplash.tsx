import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors } from "@/lib/theme";

/**
 * Premium launch animation (CAMPLX redesign, increment 2). A ~1.8–2.0s
 * white-background overlay shown on cold start:
 *   1. Logo mark fades + scales in.
 *   2. A thin orbit ring (with a small accent dot) rotates continuously
 *      behind the logo.
 *   3. The tagline fades + slides in.
 *   4. The whole overlay smoothly fades out and calls `onFinish`.
 *
 * Presentation-only: it overlays the app shell and removes itself, without
 * touching routing, auth, or data logic.
 */
type AnimatedSplashProps = {
  /** Invoked once the splash has finished fading out. */
  onFinish: () => void;
};

const RING_SIZE = 120;
const DOT_SIZE = 8;

export function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  // Root overlay fade (drives the exit + onFinish handoff).
  const rootOpacity = useSharedValue(1);
  // Logo mark: fade + gentle scale-in.
  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.9);
  // Orbit ring: fade-in + continuous rotation.
  const ringOpacity = useSharedValue(0);
  const ringRotation = useSharedValue(0);
  // Tagline: fade + small upward slide.
  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(8);

  useEffect(() => {
    // 1. Logo in at 0ms over ~500ms.
    logoOpacity.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
    logoScale.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });

    // 2. Ring fades in ~350ms, then rotates forever while the splash is up.
    ringOpacity.value = withDelay(350, withTiming(1, { duration: 400 }));
    ringRotation.value = withRepeat(
      withTiming(360, { duration: 2600, easing: Easing.linear }),
      -1
    );

    // 3. Tagline in at ~950ms over ~450ms with a subtle slide.
    taglineOpacity.value = withDelay(950, withTiming(1, { duration: 450 }));
    taglineTranslateY.value = withDelay(
      950,
      withTiming(0, { duration: 450, easing: Easing.out(Easing.cubic) })
    );

    // 4. After ~1700ms, fade the whole overlay out over ~300ms and hand off.
    rootOpacity.value = withDelay(
      1700,
      withTiming(0, { duration: 300 }, (finished) => {
        if (finished) {
          runOnJS(onFinish)();
        }
      })
    );
    // Shared values are stable across renders; run this setup exactly once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: rootOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ rotate: `${ringRotation.value}deg` }],
  }));

  const taglineStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, rootStyle]}
      className="absolute inset-0 z-50 items-center justify-center bg-surface"
    >
      {/* Logo + orbit cluster. The ring is centered behind the logo mark. */}
      <View className="items-center justify-center">
        {/* Orbit ring (behind the logo). */}
        <Animated.View
          style={[
            {
              position: "absolute",
              width: RING_SIZE,
              height: RING_SIZE,
              borderWidth: 1.5,
              borderColor: colors.border,
              borderRadius: 999,
            },
            ringStyle,
          ]}
        >
          {/* Accent dot riding on the ring's top edge. */}
          <View
            style={{
              position: "absolute",
              top: -DOT_SIZE / 2,
              left: RING_SIZE / 2 - DOT_SIZE / 2,
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: DOT_SIZE / 2,
              backgroundColor: colors.primary,
            }}
          />
        </Animated.View>

        {/* Logo mark: rounded tile with the "CX" symbol. */}
        <Animated.View style={logoStyle} className="items-center">
          <View
            className="h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-ink"
          >
            <Text className="text-2xl font-jakartaExtrabold text-white">CX</Text>
          </View>
        </Animated.View>
      </View>

      {/* Wordmark. */}
      <Animated.View style={logoStyle} className="mt-6 items-center">
        <Text
          className="text-3xl font-jakartaExtrabold text-ink"
          style={{ letterSpacing: 1.5 }}
        >
          CAMPLX
        </Text>
      </Animated.View>

      {/* Tagline. */}
      <Animated.View style={taglineStyle} className="mt-3 items-center">
        <Text className="text-base font-jakartaMedium text-muted">
          Trade smarter on campus.
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

export default AnimatedSplash;
