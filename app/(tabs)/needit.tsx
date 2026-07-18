import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Trash2 } from "lucide-react-native";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { CategoryChip } from "@/components/CategoryChip";
import { EmptyState } from "@/components/EmptyState";
import { LISTING_CATEGORIES } from "@/components/CategoryPicker";
import { colors, gradients, shadows } from "@/lib/theme";
import { useNeedItStore, type NeedRequest } from "@/stores/needItStore";

/**
 * "Need It" request board (design §4.2 `(tabs)` route group — 4th tab). Lets a
 * student post what they're looking for so their campus can help.
 *
 * This screen is FRONTEND-ONLY: requests are held in the LOCAL, device-only
 * `stores/needItStore` (AsyncStorage) and are never synced anywhere. It does
 * not touch the database, RLS, auth, or any backend service.
 *
 * // TODO(backend): sync requests server-side (a campus-scoped requests table +
 * // RLS) and support responses/matching so other students can reply.
 */

/** Shared input styling from the design system (mirrors listing/create.tsx). */
const INPUT_CLASS =
  "rounded-2xl border border-border bg-surface px-4 py-3.5 text-base font-jakarta text-ink";

/** Human label for a stored category value (falls back to the raw value). */
function categoryLabel(value: string | null): string | null {
  if (!value) return null;
  const match = LISTING_CATEGORIES.find((cat) => cat.value === value);
  return match?.label ?? value;
}

/** Short relative timestamp, e.g. "just now", "5m ago", "3d ago". */
function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

export default function NeedItScreen() {
  const requests = useNeedItStore((s) => s.requests);
  const addRequest = useNeedItStore((s) => s.add);
  const removeRequest = useNeedItStore((s) => s.remove);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [showTitleError, setShowTitleError] = useState(false);

  const trimmedTitle = title.trim();

  function onPost() {
    if (trimmedTitle.length === 0) {
      setShowTitleError(true);
      return;
    }
    const trimmedNote = note.trim();
    // TODO(backend): POST the request to the campus-scoped requests API instead
    // of the local store, and surface responses/matches.
    addRequest({
      title: trimmedTitle,
      category,
      note: trimmedNote.length > 0 ? trimmedNote : undefined,
    });
    setTitle("");
    setNote("");
    setCategory(null);
    setShowTitleError(false);
  }

  return (
    <View className="flex-1 bg-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerClassName="px-4 pb-10 pt-14"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title + subtitle */}
          <Text className="text-2xl font-jakartaExtrabold text-ink">Need It</Text>
          <Text className="mt-1 text-sm font-jakarta text-muted">
            Post what you&apos;re looking for — your campus can help.
          </Text>

          {/* Intro hero — deep-navy gradient banner. */}
          <LinearGradient
            colors={gradients.brandNavy as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[shadows.card, { borderRadius: 20 }]}
            className="mt-4 overflow-hidden rounded-card p-5"
          >
            <Text className="text-lg font-jakartaExtrabold text-white">
              Can&apos;t find it on the feed?
            </Text>
            <Text className="mt-1 text-sm font-jakarta text-white/85">
              Tell everyone what you need and let a classmate come to you.
            </Text>
          </LinearGradient>

          {/* Compose section */}
          <View
            style={shadows.soft}
            className="mt-5 rounded-2xl border border-borderLight bg-surface p-4"
          >
            <Text className="mb-2 text-sm font-jakartaSemibold text-ink">
              What are you looking for?
            </Text>
            <TextInput
              className={INPUT_CLASS}
              placeholder="e.g. A second-hand scientific calculator"
              placeholderTextColor={colors.subtle}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (showTitleError && text.trim().length > 0) {
                  setShowTitleError(false);
                }
              }}
            />
            {showTitleError ? (
              <Text className="mt-1.5 text-xs font-jakartaMedium text-danger-text">
                Add a short title so people know what you need.
              </Text>
            ) : null}

            {/* Optional note */}
            <Text className="mb-2 mt-4 text-sm font-jakartaSemibold text-ink">
              Add a note (optional)
            </Text>
            <TextInput
              className={`${INPUT_CLASS} min-h-[80px]`}
              placeholder="Budget, condition, when you need it by…"
              placeholderTextColor={colors.subtle}
              multiline
              textAlignVertical="top"
              value={note}
              onChangeText={setNote}
            />

            {/* Category tag — single-select, "Any" clears the tag. */}
            <Text className="mb-2 mt-4 text-sm font-jakartaSemibold text-ink">
              Category (optional)
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="gap-2 pr-1"
            >
              <CategoryChip
                label="Any"
                active={category === null}
                onPress={() => setCategory(null)}
              />
              {LISTING_CATEGORIES.map((cat) => (
                <CategoryChip
                  key={cat.value}
                  label={cat.label}
                  active={category === cat.value}
                  onPress={() => setCategory(cat.value)}
                />
              ))}
            </ScrollView>

            <View className="mt-4">
              <Button
                label="Post request"
                variant="primary"
                size="lg"
                fullWidth
                onPress={onPost}
              />
            </View>
          </View>

          {/* Posted requests */}
          <Text className="mb-3 mt-8 text-lg font-jakartaBold text-ink">
            Your requests
          </Text>

          {requests.length === 0 ? (
            <EmptyState
              icon="🙋"
              title="No requests yet"
              subtitle="Post something you're looking for and let your campus help."
            />
          ) : (
            <View>
              {requests.map((request) => (
                <NeedRequestCard
                  key={request.id}
                  request={request}
                  onDelete={() => removeRequest(request.id)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

type NeedRequestCardProps = {
  request: NeedRequest;
  onDelete: () => void;
};

/** A single posted request rendered as a soft-shadowed surface card. */
function NeedRequestCard({ request, onDelete }: NeedRequestCardProps) {
  const label = useMemo(
    () => categoryLabel(request.category),
    [request.category]
  );

  return (
    <View
      style={shadows.soft}
      className="mb-3 rounded-2xl bg-surface p-4"
    >
      <View className="flex-row items-start">
        <View className="flex-1 pr-3">
          <Text className="text-base font-jakartaSemibold text-ink">
            {request.title}
          </Text>

          {label ? (
            <View className="mt-2">
              <Badge label={label} tone="category" />
            </View>
          ) : null}

          {request.note ? (
            <Text className="mt-2 text-sm font-jakarta text-muted">
              {request.note}
            </Text>
          ) : null}

          <Text className="mt-2 text-xs font-jakartaMedium text-subtle">
            {relativeTime(request.createdAt)}
          </Text>
        </View>

        {/* Delete — local remove only. */}
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete request: ${request.title}`}
          className="h-9 w-9 items-center justify-center rounded-full bg-borderLight active:opacity-70"
        >
          <Trash2 size={16} color={colors.danger.text} />
        </Pressable>
      </View>
    </View>
  );
}
