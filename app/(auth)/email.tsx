import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { GraduationCap } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { Button } from "@/components/Button";
import { colors, gradients, shadows } from "@/lib/theme";
import { isDemo } from "@/lib/env";
import {
  demoSignIn,
  isCampusSupported,
  requestOtp,
  sendMagicLink,
} from "@/services/authService";

/** Shared input styling from the design system (rounded surface, Jakarta ink). */
const INPUT_CLASS =
  "rounded-2xl border border-border bg-surface px-4 py-3.5 text-base font-jakarta text-ink";

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
  const [magicSending, setMagicSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit({ email }: EmailForm) {
    if (submitting || magicSending) return; // duplicate-submission guard (Req 10.3)
    setSubmitting(true);
    setFormError(null);
    setNotice(null);
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

  /**
   * Fallback path (Req 1.3, 10.1): when email OTP delivery is flaky, send a
   * clickable magic sign-in link instead. Runs the SAME campus-supported check
   * (Req 1.2) before sending, then shows a "check your email" confirmation.
   */
  async function onMagicLink() {
    if (submitting || magicSending) return; // duplicate-submission guard (Req 10.3)
    const email = getValues("email").trim();
    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      setFormError("Enter a valid email address first.");
      return;
    }
    setMagicSending(true);
    setFormError(null);
    setNotice(null);
    try {
      const supported = await isCampusSupported(email);
      if (!supported) {
        setFormError("This campus isn't supported yet.");
        return;
      }
      await sendMagicLink(email);
      setNotice(`Check your email — we sent a sign-in link to ${email.toLowerCase()}.`);
    } catch {
      setFormError("We couldn't send your sign-in link. Please try again.");
    } finally {
      setMagicSending(false);
    }
  }

  async function onDemo() {
    if (submitting || magicSending) return;
    setSubmitting(true);
    setFormError(null);
    setNotice(null);
    try {
      await demoSignIn(); // auth gate routes into the app on success
    } catch {
      setFormError("Demo sign-in is unavailable.");
    } finally {
      setSubmitting(false);
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
          {/* Branded header — gradient logo badge + wordmark */}
          <View className="mb-10 items-center">
            <LinearGradient
              colors={gradients.authHeader as unknown as [string, string]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={shadows.card}
              className="h-20 w-20 items-center justify-center rounded-3xl"
            >
              <GraduationCap size={38} color={colors.surface} />
            </LinearGradient>
            <Text className="mt-5 text-3xl font-jakartaExtrabold text-ink">
              CAMPLX
            </Text>
            <Text className="mt-2 text-center text-base font-jakarta text-muted">
              Sign in with your institutional email to verify your campus.
            </Text>
          </View>

          {/* Email field */}
          <Text className="mb-2 text-sm font-jakartaSemibold text-ink">
            Email
          </Text>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                className={INPUT_CLASS}
                placeholder="you@university.edu"
                placeholderTextColor={colors.subtle}
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
            <Text className="mt-1.5 text-sm font-jakartaMedium text-danger-text">
              {errors.email.message}
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

          {/* Primary action — send OTP code */}
          <View className="mt-7">
            <Button
              label="Send code"
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              disabled={magicSending}
              onPress={handleSubmit(onSubmit)}
            />
          </View>

          {/* Fallback — magic sign-in link */}
          <View className="mt-3">
            <Button
              label="Email me a sign-in link instead"
              variant="ghost"
              size="lg"
              fullWidth
              loading={magicSending}
              disabled={submitting}
              onPress={onMagicLink}
            />
          </View>

          {/* Demo-mode bypass (dev only) */}
          {isDemo ? (
            <View className="mt-3">
              <Button
                label="Continue in demo mode"
                variant="outline"
                size="lg"
                fullWidth
                disabled={submitting || magicSending}
                onPress={onDemo}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
