import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronLeft, ImagePlus, Sparkles, X } from "lucide-react-native";

import { Button } from "@/components/Button";
import { CategoryPicker } from "@/components/CategoryPicker";
import { Segmented } from "@/components/Segmented";
import { colors, shadows } from "@/lib/theme";
import { generateListing } from "@/services/aiService";
import {
  assetToBase64,
  pickImages,
  uploadListingImage,
  type PickedImage,
} from "@/services/imageService";
import {
  addListingImage,
  createListing,
} from "@/services/listingService";
import { useAuthStore } from "@/stores/authStore";
import type { ListingType } from "@/types";

/**
 * Create Listing screen (design §4.2 `listing/create.tsx`, §1.6 Flow 2).
 *
 * Flow: pick a listing type (sell/donate, Req 3.1) → add ≥1 photo (Req 3.8) →
 * optionally AI-generate editable title/description/condition/price with a
 * progress indicator (Req 3.2–3.4, 3.6, 8.3) that falls back to manual entry on
 * timeout/error (Req 3.7, 10.2) → publish with validation (Req 3.5, 3.8, 3.9)
 * guarded against duplicate submission (Req 10.3).
 *
 * The publish path reads the acting user from `authStore.profile` (NOT mocked)
 * and creates the listing (carbon baseline set at creation, Req 6.1/6.3),
 * uploads each image to Storage, records `listing_images` rows, invalidates the
 * feed cache, and navigates to the new listing.
 */

/** Max images sent to the AI proxy — keeps the request small/fast (Req 8.3). */
const AI_MAX_IMAGES = 3;

/** Shared input styling from the design system (rounded surface, Jakarta ink). */
const INPUT_CLASS =
  "rounded-2xl border border-border bg-surface px-4 py-3.5 text-base font-jakarta text-ink";

const createListingSchema = z
  .object({
    listingType: z.enum(["sell", "donate"]),
    category: z.string().min(1, "Please choose a category"),
    title: z.string().trim().min(1, "Title is required"),
    description: z.string().trim().optional().default(""),
    condition: z.string().trim().min(1, "Condition is required"),
    price: z.string().optional().default(""),
  })
  .superRefine((val, ctx) => {
    // Price required (and positive) for `sell`; omitted for `donate`
    // (Req 3.5, 3.9).
    if (val.listingType === "sell") {
      const n = Number.parseFloat((val.price ?? "").trim());
      if (!Number.isFinite(n) || n <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["price"],
          message: "Enter a price for a sale listing",
        });
      }
    }
  });

type CreateListingForm = z.input<typeof createListingSchema>;

type AiState = "idle" | "loading" | "done" | "failed";

export default function CreateListingScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [images, setImages] = useState<PickedImage[]>([]);
  const [imageError, setImageError] = useState<string | null>(null);
  const [aiState, setAiState] = useState<AiState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateListingForm>({
    resolver: zodResolver(createListingSchema),
    defaultValues: {
      listingType: "sell",
      category: "",
      title: "",
      description: "",
      condition: "",
      price: "",
    },
  });

  const listingType = watch("listingType") as ListingType;
  const category = watch("category");

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  async function onAddImages() {
    setImageError(null);
    const picked = await pickImages({ multiple: true });
    if (picked.length > 0) setImages((prev) => [...prev, ...picked]);
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  // AI generate (Req 3.2–3.4, 8.3) with deterministic manual-entry fallback
  // (Req 3.7, 10.2). Populates the editable fields; fields stay editable so the
  // seller can adjust or type everything manually if AI is unavailable.
  async function onGenerate() {
    if (images.length < 1) {
      setImageError("Add a photo first so AI can help.");
      return;
    }
    setAiState("loading");

    const base64s: string[] = [];
    for (const img of images.slice(0, AI_MAX_IMAGES)) {
      try {
        base64s.push(await assetToBase64(img));
      } catch {
        // Skip an unreadable asset — AI can still work from the rest.
      }
    }

    const note = (watch("title") ?? "").trim();
    const result = await generateListing({
      imageBase64: base64s,
      text: note.length > 0 ? note : undefined,
      listingType,
    });

    if (result.ok) {
      setValue("title", result.data.title, { shouldValidate: true });
      setValue("description", result.data.description ?? "");
      setValue("condition", result.data.condition, { shouldValidate: true });
      if (listingType === "sell" && result.data.price != null) {
        setValue("price", String(result.data.price), { shouldValidate: true });
      }
      setAiState("done");
    } else {
      // Clean fallback: publishing continues via manual entry (Req 3.7, 10.2).
      setAiState("failed");
    }
  }

  const onPublish = handleSubmit(async (values) => {
    // Duplicate-submission guard while a publish is already in flight (Req 10.3).
    if (submitting) return;
    setFormError(null);

    // ≥1 image required to publish (Req 3.8).
    if (images.length < 1) {
      setImageError("Add at least one photo to publish.");
      return;
    }

    // Read the acting user from the auth store (NOT mocked).
    // TODO(auth): `profile` is populated by the future authenticated, verified
    // user object. `profile.id` becomes `seller_id` and `profile.campus_id`
    // becomes the listing's `campus_id` — RLS enforces both match the caller
    // (design §1.5). If there is no verified profile yet, no-op with guidance
    // rather than crash or fabricate a session.
    const profile = useAuthStore.getState().profile;
    if (!profile || !profile.campus_id) {
      setFormError(
        "You need a verified campus account to publish a listing.",
      );
      return;
    }

    setSubmitting(true);
    try {
      const price =
        values.listingType === "sell"
          ? Number.parseFloat((values.price ?? "").trim())
          : null;

      const listingId = await createListing({
        sellerId: profile.id,
        campusId: profile.campus_id,
        listingType: values.listingType,
        title: values.title.trim(),
        description: (values.description ?? "").trim() || null,
        category: values.category,
        condition: values.condition.trim(),
        price,
      });

      // Upload each picked image; tolerate an individual failure and proceed
      // without it, but require at least one successful image (design §1.7,
      // Req 3.8, 10.2).
      let uploaded = 0;
      for (let i = 0; i < images.length; i++) {
        try {
          const storagePath = await uploadListingImage(
            profile.id,
            listingId,
            images[i],
          );
          await addListingImage(listingId, storagePath, uploaded);
          uploaded += 1;
        } catch {
          // Skip the failed image and continue with the rest.
        }
      }

      if (uploaded === 0) {
        throw new Error("No images could be uploaded.");
      }

      // Refresh the campus feed so the new listing appears (Req 4.1).
      await queryClient.invalidateQueries({ queryKey: ["feed"] });

      router.replace(`/listing/${listingId}`);
    } catch {
      setFormError(
        "Something went wrong publishing your listing. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header — rounded surface back button (soft shadow) + title */}
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-14">
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={shadows.soft}
          className="h-11 w-11 items-center justify-center rounded-2xl bg-surface active:opacity-70"
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <Text className="text-xl font-jakartaBold text-ink">New listing</Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="px-5 pb-10 pt-4"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Listing type (Req 3.1) */}
          <Text className="mb-2 text-sm font-jakartaSemibold text-ink">
            Listing type
          </Text>
          <Controller
            control={control}
            name="listingType"
            render={({ field: { value, onChange } }) => (
              <Segmented<ListingType>
                options={[
                  { label: "Sell", value: "sell" },
                  { label: "Donate", value: "donate" },
                ]}
                value={value as ListingType}
                onChange={onChange}
              />
            )}
          />

          {/* Photos (Req 3.8) */}
          <Text className="mb-2 mt-6 text-sm font-jakartaSemibold text-ink">
            Photos
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-3"
          >
            {images.map((img, index) => (
              <View key={`${img.uri}-${index}`} className="relative">
                <Image
                  source={{ uri: img.uri }}
                  className="h-24 w-24 rounded-2xl bg-borderLight"
                  resizeMode="cover"
                />
                <Pressable
                  className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-ink active:opacity-80"
                  onPress={() => removeImage(index)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${index + 1}`}
                >
                  <X size={13} color={colors.surface} />
                </Pressable>
              </View>
            ))}
            <Pressable
              className="h-24 w-24 items-center justify-center rounded-2xl border border-dashed border-border bg-surface active:opacity-70"
              onPress={onAddImages}
              accessibilityRole="button"
              accessibilityLabel="Add photos"
            >
              <ImagePlus size={22} color={colors.muted} />
              <Text className="mt-1 text-xs font-jakartaMedium text-muted">
                Add
              </Text>
            </Pressable>
          </ScrollView>
          {imageError ? (
            <Text className="mt-1.5 text-xs font-jakartaMedium text-danger-text">
              {imageError}
            </Text>
          ) : null}

          {/* AI generate (Req 3.2, 8.3) — subtle card */}
          <View
            style={shadows.soft}
            className="mt-5 rounded-2xl border border-borderLight bg-surface p-4"
          >
            <Button
              label={
                aiState === "loading" ? "Generating…" : "Generate with AI"
              }
              variant="outline"
              size="md"
              fullWidth
              icon={<Sparkles size={18} color={colors.ink} />}
              loading={aiState === "loading"}
              disabled={submitting}
              onPress={onGenerate}
            />
            {aiState === "failed" ? (
              <Text className="mt-2 text-xs font-jakartaMedium text-amber-text">
                AI is unavailable right now — fill in the details manually below
                and publish as usual.
              </Text>
            ) : null}
            {aiState === "done" ? (
              <Text className="mt-2 text-xs font-jakarta text-muted">
                AI filled in the details below — edit anything before publishing.
              </Text>
            ) : null}
          </View>

          {/* Editable fields (Req 3.6) */}
          <Text className="mb-2 mt-6 text-sm font-jakartaSemibold text-ink">
            Title
          </Text>
          <Controller
            control={control}
            name="title"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className={INPUT_CLASS}
                placeholder="e.g. Hero cycle, good condition"
                placeholderTextColor={colors.subtle}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
          {errors.title ? (
            <Text className="mt-1.5 text-xs font-jakartaMedium text-danger-text">
              {errors.title.message}
            </Text>
          ) : null}

          {/* Category (Req 3.8) */}
          <Text className="mb-2 mt-6 text-sm font-jakartaSemibold text-ink">
            Category
          </Text>
          <Controller
            control={control}
            name="category"
            render={({ field: { onChange } }) => (
              <CategoryPicker value={category} onChange={onChange} />
            )}
          />
          {errors.category ? (
            <Text className="mt-1.5 text-xs font-jakartaMedium text-danger-text">
              {errors.category.message}
            </Text>
          ) : null}

          {/* Condition (Req 3.8) */}
          <Text className="mb-2 mt-6 text-sm font-jakartaSemibold text-ink">
            Condition
          </Text>
          <Controller
            control={control}
            name="condition"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className={INPUT_CLASS}
                placeholder="e.g. Like New, Good, Fair"
                placeholderTextColor={colors.subtle}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
          {errors.condition ? (
            <Text className="mt-1.5 text-xs font-jakartaMedium text-danger-text">
              {errors.condition.message}
            </Text>
          ) : null}

          {/* Price — only for `sell` (Req 3.5, 3.9) */}
          {listingType === "sell" ? (
            <>
              <Text className="mb-2 mt-6 text-sm font-jakartaSemibold text-ink">
                Price (₹)
              </Text>
              <Controller
                control={control}
                name="price"
                render={({ field: { value, onChange, onBlur } }) => (
                  <TextInput
                    className={INPUT_CLASS}
                    placeholder="e.g. 1500"
                    placeholderTextColor={colors.subtle}
                    keyboardType="numeric"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                  />
                )}
              />
              {errors.price ? (
                <Text className="mt-1.5 text-xs font-jakartaMedium text-danger-text">
                  {errors.price.message}
                </Text>
              ) : null}
            </>
          ) : null}

          {/* Description (optional, editable) */}
          <Text className="mb-2 mt-6 text-sm font-jakartaSemibold text-ink">
            Description
          </Text>
          <Controller
            control={control}
            name="description"
            render={({ field: { value, onChange, onBlur } }) => (
              <TextInput
                className={`${INPUT_CLASS} min-h-[96px]`}
                placeholder="Add any details buyers should know"
                placeholderTextColor={colors.subtle}
                multiline
                textAlignVertical="top"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />

          {formError ? (
            <Text className="mt-4 text-sm font-jakartaMedium text-danger-text">
              {formError}
            </Text>
          ) : null}

          {/* Publish (Req 3.8, 3.9, 10.3) */}
          <View className="mt-8">
            <Button
              label={submitting ? "Publishing…" : "Publish listing"}
              variant="primary"
              size="lg"
              fullWidth
              loading={submitting}
              onPress={onPublish}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
