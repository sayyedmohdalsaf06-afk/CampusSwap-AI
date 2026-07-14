import "react-native-url-polyfill/auto";
import "../global.css";

import { useEffect } from "react";
import { View } from "react-native";
import { Slot, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { fetchProfile } from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";
import type { AuthStatus, Profile } from "@/types";

/**
 * Derive the auth-gate status from the current session + profile.
 *  - no session            → unauthenticated
 *  - session, verified     → authenticated
 *  - session, not verified → unverified (e.g. unsupported campus domain, Req 1.2)
 */
function deriveStatus(
  hasSession: boolean,
  profile: Profile | null
): AuthStatus {
  if (!hasSession) return "unauthenticated";
  if (profile?.verified_student) return "authenticated";
  return "unverified";
}

/**
 * Auth gate (design §4.2, task 4.3). Redirects based on auth status:
 *  - while `loading` → render nothing (splash)
 *  - unauthenticated / unverified → force into the (auth) group
 *  - authenticated + currently in (auth) → send to the app shell (`/`)
 */
function useAuthGate() {
  const status = useAuthStore((s) => s.status);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;

    const inAuthGroup = segments[0] === "(auth)";

    if (status === "authenticated") {
      if (inAuthGroup) router.replace("/");
    } else {
      // unauthenticated OR unverified → gate to the email screen.
      if (!inAuthGroup) router.replace("/(auth)/email");
    }
  }, [status, segments, router]);
}

/** Hydrate the session + profile on mount and subscribe to auth changes. */
function useHydrateAuth() {
  const { setSession, setProfile, setStatus } = useAuthStore();

  useEffect(() => {
    let active = true;

    async function syncFromSession(hasSession: boolean) {
      const profile = hasSession ? await fetchProfile() : null;
      if (!active) return;
      setProfile(profile);
      setStatus(deriveStatus(hasSession, profile));
    }

    // Initial hydration from the persisted (secure-store) session.
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!active) return;
      setSession(session);
      await syncFromSession(session != null);
    })();

    // React to sign-in / sign-out / token refresh.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setStatus("loading");
      void syncFromSession(session != null);
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

  const status = useAuthStore((s) => s.status);

  // Splash while hydrating — avoids showing the wrong screen (Req 2.1 gating).
  if (status === "loading") {
    return <View className="flex-1 bg-white" />;
  }

  return <Slot />;
}

/**
 * Root layout. Providers + auth gate. Feature screens are added by later tasks
 * — this only wires session hydration and routing.
 */
export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="auto" />
      <RootNavigator />
    </QueryClientProvider>
  );
}
