import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ShieldCheck } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/Button";
import { colors, gradients, shadows } from "@/lib/theme";
import { requestOtp, verifyOtp } from "@/services/authService";

/** Shared input styling from the design system, tuned for a centered code. */
const CODE_INPUT_CLASS =
  "rounded-2xl border border-border bg-surface px-4 py-3.5 text-center text-2xl font-jakartaBold tracking-widest text-ink";

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
    <View className="flex-1 bg-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-16"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Branded header — gradient badge + title */}
          <View className="mb-10 items-center">
            <LinearGradient
              colors={gradients.authHeader as unknown as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={shadows.card}
              className="h-20 w-20 items-center justify-center rounded-3xl"
            >
              <ShieldCheck size={38} color={colors.surface} />
            </LinearGradient>
            <Text className="mt-5 text-3xl font-jakartaExtrabold text-ink">
              Enter your code
            </Text>
            <Text className="mt-2 text-center text-base font-jakarta text-muted">
              We sent a 6-digit code to {email ?? "your email"}.
            </Text>
          </View>

          {/* Code field */}
          <Text className="mb-2 text-sm font-jakartaSemibold text-ink">
            Code
          </Text>
          <Controller
            control={control}
            name="code"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className={CODE_INPUT_CLASS}
                placeholder="123456"
                placeholderTextColor={colors.subtle}
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
            <Text className="mt-1.5 text-sm font-jakartaMedium text-danger-text">
              {errors.code.message}
            </Text>
          ) : null}
          {formError ? (
            <Text className="mt-2 text-sm font-jakartaMedium text-danger-text">
              {formError}
            </Text>
          ) : null}
          {notice ? (
            <Text className="mt-2 text-sm font-jakartaMedium text-green-700">
              {notice}
            </Text>
          ) : null}

          {/* Verify code */}
          <View className="mt-7">
            <Button
              label="Verify"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              onPress={handleSubmit(onSubmit)}
            />
          </View>

          {/* Resend code */}
          <View className="mt-3">
            <Button
              label="Resend code"
              variant="ghost"
              size="lg"
              fullWidth
              loading={resending}
              onPress={onResend}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
