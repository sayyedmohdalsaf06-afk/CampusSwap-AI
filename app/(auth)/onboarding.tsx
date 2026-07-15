import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { signOut } from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";

/**
 * Onboarding / incomplete-profile screen (Req 1.2, 2.1, 6).
 *
 * Shown when a session exists but the profile is INCOMPLETE — no profile row
 * yet, `campus_id` is null, or `verified_student` is false (e.g. the email's
 * domain isn't in the Domain_Campus_Map, so the campus isn't supported yet).
 *
 * The profile is finalized SERVER-SIDE by the handle_new_user trigger; this
 * screen never writes a profile. It offers:
 *  - "Refresh" — re-read session + profile in case the trigger just finished
 *    (the root gate advances to the app shell once the profile is complete).
 *  - "Sign out" — return to the email screen with a clean session.
 */
export default function OnboardingScreen() {
  const profile = useAuthStore((s) => s.profile);
  const refresh = useAuthStore((s) => s.refresh);
  const [busy, setBusy] = useState(false);

  // Distinguish "campus not supported" (row exists, but unverified / no campus)
  // from "still finalizing" (no profile row read yet).
  const campusUnsupported =
    profile != null && !profile.verified_student && !profile.campus_id;

  const heading = campusUnsupported
    ? "Campus not supported yet"
    : "Finishing sign-in…";

  const body = campusUnsupported
    ? "Your email domain isn't linked to a supported campus yet, so we couldn't verify you as a student. If you think this is a mistake, try a different institutional email, or check back once your campus is added."
    : "We're finalizing your campus verification. This usually takes just a moment — tap Refresh if it doesn't complete automatically.";

  async function onRefresh() {
    if (busy) return;
    setBusy(true);
    try {
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    if (busy) return;
    setBusy(true);
    try {
      await signOut(); // root gate routes back to /(auth)/email
    } finally {
      setBusy(false);
    }
  }

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-gray-900">{heading}</Text>
      <Text className="mt-3 text-base text-gray-500">{body}</Text>

      {profile?.email ? (
        <Text className="mt-4 text-sm text-gray-400">
          Signed in as {profile.email}
        </Text>
      ) : null}

      <Pressable
        className="mt-8 items-center rounded-lg bg-gray-900 py-3 active:opacity-80"
        disabled={busy}
        onPress={onRefresh}
        accessibilityRole="button"
        accessibilityLabel="Refresh verification status"
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">Refresh</Text>
        )}
      </Pressable>

      <Pressable
        className="mt-3 items-center rounded-lg border border-gray-300 py-3 active:opacity-80"
        disabled={busy}
        onPress={onSignOut}
        accessibilityRole="button"
        accessibilityLabel="Sign out"
      >
        <Text className="text-base font-semibold text-gray-900">Sign out</Text>
      </Pressable>
    </View>
  );
}
