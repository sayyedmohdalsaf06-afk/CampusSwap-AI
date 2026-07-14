import { Stack } from "expo-router";

/**
 * Auth route group layout. Minimal headerless stack for the email → otp flow
 * (design §4.2 `(auth)` route group). The auth gate lives in the root layout.
 */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
