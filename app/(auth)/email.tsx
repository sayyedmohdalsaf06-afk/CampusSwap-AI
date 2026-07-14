import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { isDemo } from "@/lib/env";
import {
  demoSignIn,
  isCampusSupported,
  requestOtp,
} from "@/services/authService";

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your institutional email")
    .email("Enter a valid email address"),
});

type EmailForm = z.infer<typeof emailSchema>;

/**
 * Email Entry screen (design §4.2 `(auth)/email.tsx`, Req 1.1–1.3, 10.1).
 * Validates the email, checks the campus is supported, then requests an OTP and
 * routes to the OTP screen. In demo mode, offers a dev-bypass sign-in.
 */
export default function EmailScreen() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: EmailForm) {
    if (submitting) return; // duplicate-submission guard (Req 10.3)
    setSubmitting(true);
    setFormError(null);
    try {
      const supported = await isCampusSupported(email);
      if (!supported) {
        // Unsupported domain → no OTP sent (Req 1.2).
        setFormError("This campus isn't supported yet.");
        return;
      }
      await requestOtp(email); // Req 1.3
      router.push({
        pathname: "/(auth)/otp",
        params: { email: email.trim().toLowerCase() },
      });
    } catch {
      // Delivery / network failure — allow retry (Req 10.1).
      setFormError("We couldn't send your code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDemo() {
    if (submitting) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await demoSignIn(); // auth gate routes into the app on success
    } catch {
      setFormError("Demo sign-in is unavailable.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-gray-900">CampusSwap AI</Text>
      <Text className="mt-2 text-base text-gray-500">
        Sign in with your institutional email to verify your campus.
      </Text>

      <View className="mt-8">
        <Text className="mb-1 text-sm font-medium text-gray-700">Email</Text>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="rounded-lg border border-gray-300 px-4 py-3 text-base text-gray-900"
              placeholder="you@university.edu"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              editable={!submitting}
            />
          )}
        />
        {errors.email ? (
          <Text className="mt-1 text-sm text-red-600">
            {errors.email.message}
          </Text>
        ) : null}
        {formError ? (
          <Text className="mt-2 text-sm text-red-600">{formError}</Text>
        ) : null}
      </View>

      <Pressable
        className="mt-6 items-center rounded-lg bg-gray-900 py-3 active:opacity-80"
        disabled={submitting}
        onPress={handleSubmit(onSubmit)}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">
            Send code
          </Text>
        )}
      </Pressable>

      {isDemo ? (
        <Pressable
          className="mt-3 items-center rounded-lg border border-gray-300 py-3 active:opacity-80"
          disabled={submitting}
          onPress={onDemo}
        >
          <Text className="text-base font-semibold text-gray-900">
            Continue in demo mode
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
