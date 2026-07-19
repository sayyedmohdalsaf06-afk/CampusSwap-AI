import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";

import { exchangeCodeIfPresent } from "@/services/authService";

/**
 * Auth callback screen (Req 1.3, 10.1). Landing target for magic-link /
 * email-redirect sign-ins.
 *
 *  - WEB: `detectSessionInUrl` (lib/supabase.ts) already parses the session
 *    from the URL on load; this screen just shows a spinner while the root
 *    auth gate reacts to onAuthStateChange and routes onward.
 *  - NATIVE: `detectSessionInUrl` is disabled, so we read the incoming deep
 *    link and finish the exchange explicitly (exchangeCodeForSession /
 *    setSession) via exchangeCodeIfPresent().
 *
 * On any error we route back to /(auth)/email so the user can retry.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    async function completeExchange(url: string | null) {
      if (!url) return;
      try {
        await exchangeCodeIfPresent(url);
        // Success → onAuthStateChange fires and the root gate routes us to the
        // right place (app shell or onboarding). Nothing else to do here.
      } catch (e) {
        if (__DEV__) console.warn("[callback] exchange failed:", e);
        if (!active) return;
        setFailed(true);
        router.replace("/(auth)/email");
      }
    }

    if (Platform.OS === "web") {
      // detectSessionInUrl handles web; the gate will move us off this screen.
      return () => {
        active = false;
      };
    }

    // Native: handle both the cold-start URL and a URL delivered while open.
    (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (active) await completeExchange(initialUrl);
    })();

    const sub = Linking.addEventListener("url", ({ url }) => {
      void completeExchange(url);
    });

    return () => {
      active = false;
      sub.remove();
    };
  }, [router]);

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <ActivityIndicator color="#111827" />
      <Text className="mt-4 text-base text-gray-500">
        {failed ? "Sign-in link couldn't be completed." : "Signing you in…"}
      </Text>
    </View>
  );
}
