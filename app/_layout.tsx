import "react-native-url-polyfill/auto";
import "../global.css";

import { useEffect } from "react";
import { View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  useFonts,
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

import { queryClient } from "@/lib/queryClient";
// NOTE: EXPO_PUBLIC_SKIP_AUTH is intentionally NOT imported/branched on at
// runtime anymore (deprecated dev bypass). See the commented DEV-ONLY block in
// useAuthGate() if you need to temporarily re-enable it.
import { supabase } from "@/lib/supabase";
import { fetchProfile } from "@/services/authService";
import { deriveStatus, useAuthStore } from "@/stores/authStore";

/**
 * Auth gate (design §4.2, Req 2.1, Req 6). Redirects based on auth status:
 *  - `loading`        → render nothing (splash)
 *  - `unauthenticated`→ force into the (auth) group at /(auth)/email
 *  - `onboarding`     → session but incomplete/unverified profile → /(auth)/onboarding
 *                       (e.g. no profile row yet, no campus_id, or unsupported
 *                       campus domain, Req 1.2)
 *  - `authenticated`  → verified student with a campus → app shell (`/`)
 */
function useAuthGate() {
  const status = useAuthStore((s) => s.status);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    /* ─── DEV-ONLY AUTH BYPASS (deprecated; disabled) ──────────────────────
     * Historically gated on EXPO_PUBLIC_SKIP_AUTH to test authenticated UI
     * while auth was paused. It is intentionally DISABLED — nothing branches
     * on SKIP_AUTH at runtime. To re-enable manually, uncomment this block and
     * re-import SKIP_AUTH from "@/lib/env":
     *
     *   if (SKIP_AUTH) {
     *     if (segments[0] === "(auth)") router.replace("/");
     *     return;
     *   }
     * ──────────────────────────────────────────────────────────────────── */

    if (__DEV__) {
      console.log("[authGate] status:", status, "segments:", segments.join("/") || "(root)");
    }

    if (status === "loading") return;

    const inAuthGroup = segments[0] === "(auth)";

    if (status === "unauthenticated") {
      if (!inAuthGroup) router.replace("/(auth)/email");
      return;
    }

    if (status === "onboarding" || status === "unverified") {
      // Session exists but the profile isn't a complete Verified_Student yet.
      const onOnboarding = segments[0] === "(auth)" && segments[1] === "onboarding";
      if (!onOnboarding) router.replace("/(auth)/onboarding");
      return;
    }

    // authenticated → leave the (auth) group for the app shell.
    if (status === "authenticated" && inAuthGroup) {
      router.replace("/");
    }
  }, [status, segments, router]);
}

/** Hydrate the session + profile on mount and subscribe to auth changes. */
function useHydrateAuth() {
  const { setSession, setProfile, setStatus } = useAuthStore();

  useEffect(() => {
    let active = true;

    async function syncFromSession(hasSession: boolean, userId: string | null) {
      if (__DEV__) {
        console.log("[auth] syncFromSession: hasSession=", hasSession, "userId=", userId);
      }
      const profile = hasSession ? await fetchProfile() : null;
      if (!active) return;
      if (__DEV__) {
        console.log("[auth] syncFromSession: profile loaded", {
          hasProfile: profile != null,
          campusId: profile?.campus_id ?? null,
          verifiedStudent: profile?.verified_student ?? false,
        });
      }
      setProfile(profile);
      setStatus(deriveStatus(hasSession, profile));
    }

    // Initial hydration from the persisted session (AsyncStorage / localStorage).
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      if (__DEV__) {
        console.log("[auth] initial getSession:", {
          hasSession: session != null,
          userId: session?.user?.id ?? null,
        });
      }
      setSession(session);
      await syncFromSession(session != null, session?.user?.id ?? null);
    })();

    // React to sign-in / sign-out / token refresh / magic-link callback.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (__DEV__) {
        console.log("[auth] onAuthStateChange:", event, {
          hasSession: session != null,
          userId: session?.user?.id ?? null,
        });
      }
      setSession(session);
      setStatus("loading");
      void syncFromSession(session != null, session?.user?.id ?? null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [setSession, setProfile, setStatus]);
}

function RootNavigator() {
  useHydrateAuth();
  useAuthGate();

  // Load the Plus Jakarta Sans family and map each weight onto the family names
  // referenced by the Tailwind theme (`Jakarta`, `Jakarta-Medium`, etc.). This
  // is presentation-only and does not affect the auth gate below.
  const [fontsLoaded] = useFonts({
    Jakarta: PlusJakartaSans_400Regular,
    "Jakarta-Medium": PlusJakartaSans_500Medium,
    "Jakarta-Semibold": PlusJakartaSans_600SemiBold,
    "Jakarta-Bold": PlusJakartaSans_700Bold,
    "Jakarta-Extrabold": PlusJakartaSans_800ExtraBold,
  });

  const status = useAuthStore((s) => s.status);

  // Splash while hydrating OR while fonts load — avoids a flash of the wrong
  // screen (Req 2.1 gating) or unstyled text before the type family is ready.
  if (status === "loading" || !fontsLoaded) {
    return <View className="flex-1 bg-white" />;
  }

  return <Slot />;
}

/**
 * Root layout. Providers + auth gate. Wires session hydration and routing.
 */
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <RootNavigator />
    </QueryClientProvider>
  );
}
