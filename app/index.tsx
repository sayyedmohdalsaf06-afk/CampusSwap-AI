import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { supabase } from "@/lib/supabase";
import { signOut } from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";

/**
 * Post-login app shell (placeholder). Confirms the verified session and shows
 * the assigned campus name + a sign-out action. This is NOT the feed or any
 * feature screen — those are added by later tasks. The root auth gate ensures
 * only authenticated + verified students reach this route.
 */
export default function Index() {
  const profile = useAuthStore((s) => s.profile);
  const reset = useAuthStore((s) => s.reset);
  const [campusName, setCampusName] = useState<string | null>(null);
  const [loadingCampus, setLoadingCampus] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      if (!profile?.campus_id) {
        if (active) {
          setCampusName(null);
          setLoadingCampus(false);
        }
        return;
      }
      const { data } = await supabase
        .from("campuses")
        .select("name")
        .eq("id", profile.campus_id)
        .maybeSingle();
      if (!active) return;
      setCampusName((data?.name as string | undefined) ?? null);
      setLoadingCampus(false);
    })();

    return () => {
      active = false;
    };
  }, [profile?.campus_id]);

  async function onSignOut() {
    await signOut();
    reset(); // auth gate routes back to (auth)/email
  }

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-gray-900">CampusSwap AI</Text>
      <Text className="mt-2 text-base text-green-700">You're verified</Text>

      <View className="mt-4 items-center">
        <Text className="text-sm text-gray-500">Your campus</Text>
        {loadingCampus ? (
          <ActivityIndicator className="mt-1" color="#111827" />
        ) : (
          <Text className="mt-1 text-base font-medium text-gray-900">
            {campusName ?? "Unknown"}
          </Text>
        )}
      </View>

      <Pressable
        className="mt-8 items-center rounded-lg border border-gray-300 px-6 py-3 active:opacity-80"
        onPress={onSignOut}
      >
        <Text className="text-base font-semibold text-gray-900">Sign out</Text>
      </Pressable>
    </View>
  );
}
