import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { requestOtp, verifyOtp } from "@/services/authService";

const otpSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

type OtpForm = z.infer<typeof otpSchema>;

/**
 * OTP Entry screen (design §4.2 `(auth)/otp.tsx`, Req 1.4–1.7, 10.1).
 * Reads the `email` param, verifies the 6-digit code, and — on success — the
 * root auth gate routes into the app. Shows invalid/expired errors and a
 * resend action.
 */
export default function OtpScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<OtpForm>({
    resolver: zodResolver(otpSchema),
    defaultValues: { code: "" },
  });

  async function onSubmit({ code }: OtpForm) {
    if (submitting || !email) return; // duplicate-submission guard (Req 10.3)
    setSubmitting(true);
    setFormError(null);
    setNotice(null);
    try {
      await verifyOtp(email, code); // Req 1.4; gate routes on success
    } catch {
      // Invalid or expired code — offer resend (Req 1.5, 1.7).
      setFormError("That code is invalid or expired. Request a new one.");
    } finally {
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (resending || !email) return;
    setResending(true);
    setFormError(null);
    setNotice(null);
    try {
      await requestOtp(email); // Req 1.7, 10.1
      setNotice("A new code is on its way.");
    } catch {
      setFormError("We couldn't resend your code. Please try again.");
    } finally {
      setResending(false);
    }
  }

  return (
    <View className="flex-1 justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-gray-900">Enter your code</Text>
      <Text className="mt-2 text-base text-gray-500">
        We sent a 6-digit code to {email ?? "your email"}.
      </Text>

      <View className="mt-8">
        <Text className="mb-1 text-sm font-medium text-gray-700">Code</Text>
        <Controller
          control={control}
          name="code"
          render={({ field: { onChange, onBlur, value } }) => (
            <TextInput
              className="rounded-lg border border-gray-300 px-4 py-3 text-base tracking-widest text-gray-900"
              placeholder="123456"
              keyboardType="number-pad"
              maxLength={6}
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              editable={!submitting}
            />
          )}
        />
        {errors.code ? (
          <Text className="mt-1 text-sm text-red-600">
            {errors.code.message}
          </Text>
        ) : null}
        {formError ? (
          <Text className="mt-2 text-sm text-red-600">{formError}</Text>
        ) : null}
        {notice ? (
          <Text className="mt-2 text-sm text-green-700">{notice}</Text>
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
          <Text className="text-base font-semibold text-white">Verify</Text>
        )}
      </Pressable>

      <Pressable
        className="mt-3 items-center py-3 active:opacity-60"
        disabled={resending}
        onPress={onResend}
      >
        <Text className="text-base font-medium text-gray-700">
          {resending ? "Resending…" : "Resend code"}
        </Text>
      </Pressable>
    </View>
  );
}
