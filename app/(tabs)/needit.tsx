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
import { MotiView } from "moti";
import { Flame, Trash2, Users } from "lucide-react-native";

import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { CategoryChip } from "@/components/CategoryChip";
import { EmptyState } from "@/components/EmptyState";
import { LISTING_CATEGORIES } from "@/components/CategoryPicker";
import { colors, gradients, shadows } from "@/lib/theme";
import {
  useNeedItStore,
  type NeedRequest,
  type NeedUrgency,
} from "@/stores/needItStore";

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

/** Selectable urgency levels for the compose card (single-select). */
const URGENCY_OPTIONS: { value: NeedUrgency; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
];

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

/** Presentational config for an urgency value (label + tint classes). */
const URGENCY_META: Record<
  NeedUrgency,
  { label: string; container: string; text: string }
> = {
  // Low → muted/neutral slate tint.
  low: { label: "Low", container: "bg-borderLight", text: "text-muted" },
  // Normal → violet accent.
  normal: { label: "Normal", container: "bg-violet-bg", text: "text-violet-text" },
  // Urgent → amber/danger accent (with a flame icon on the badge).
  urgent: { label: "Urgent", container: "bg-amber-bg", text: "text-amber-text" },
};

/** Small pill showing a request's urgency with its accent + optional icon. */
function UrgencyBadge({ urgency }: { urgency: NeedUrgency }) {
  const meta = URGENCY_META[urgency];
  return (
    <View
      className={`flex-row items-center self-start rounded-full px-2.5 py-1 ${meta.container}`}
    >
      {urgency === "urgent" ? (
        <View className="mr-1">
          <Flame size={12} color={colors.amber.text} />
        </View>
      ) : null}
      <Text className={`text-xs font-jakartaSemibold ${meta.text}`}>
        {meta.label}
      </Text>
    </View>
  );
}

/**
 * A mock "Around campus" community request from another student. Purely
 * presentational sample data — NOT interactive and never synced to a backend.
 */
type CommunityRequest = {
  id: string;
  initials: string;
  title: string;
  category: string;
  urgency: NeedUrgency;
  timeAgo: string;
};

/** Sample community requests to make the board feel campus-driven. */
const COMMUNITY_REQUESTS: CommunityRequest[] = [
  {
    id: "sample-1",
    initials: "AR",
    title: "Graphing calculator for finals week",
    category: "electronics",
    urgency: "urgent",
    timeAgo: "12m ago",
  },
  {
    id: "sample-2",
    initials: "MK",
    title: "Intro to Economics textbook (10th ed.)",
    category: "books",
    urgency: "normal",
    timeAgo: "1h ago",
  },
  {
    id: "sample-3",
    initials: "JT",
    title: "Mini fridge for dorm room",
    category: "furniture",
    urgency: "low",
    timeAgo: "3h ago",
  },
  {
    id: "sample-4",
    initials: "SL",
    title: "Desk lamp with USB port",
    category: "furniture",
    urgency: "normal",
    timeAgo: "5h ago",
  },
];

export default function NeedItScreen() {
  const requests = useNeedItStore((s) => s.requests);
  const addRequest = useNeedItStore((s) => s.add);
  const removeRequest = useNeedItStore((s) => s.remove);

  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [urgency, setUrgency] = useState<NeedUrgency>("normal");
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
      urgency,
    });
    setTitle("");
    setNote("");
    setCategory(null);
    setUrgency("normal");
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

            {/* Urgency — single-select pills, default "Normal". */}
            <Text className="mb-2 mt-4 text-sm font-jakartaSemibold text-ink">
              How urgent is it?
            </Text>
            <View className="flex-row gap-2">
              {URGENCY_OPTIONS.map((option) => {
                const selected = urgency === option.value;
                const meta = URGENCY_META[option.value];
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setUrgency(option.value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Urgency: ${option.label}`}
                    className={`flex-row items-center rounded-full px-4 py-2 active:opacity-80 ${
                      selected
                        ? meta.container
                        : "border border-borderLight bg-surface"
                    }`}
                  >
                    {option.value === "urgent" && selected ? (
                      <View className="mr-1">
                        <Flame size={13} color={colors.amber.text} />
                      </View>
                    ) : null}
                    <Text
                      className={`text-sm font-jakartaSemibold ${
                        selected ? meta.text : "text-muted"
                      }`}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

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

          {/* Around campus — mock community requests (presentational sample). */}
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 420 }}
          >
            <View className="mb-1 mt-8 flex-row items-center">
              <Users size={18} color={colors.ink} />
              <Text className="ml-2 text-lg font-jakartaBold text-ink">
                Around campus
              </Text>
            </View>
            <Text className="mb-3 text-xs font-jakarta text-subtle">
              Sample requests from your campus
            </Text>

            <View>
              {COMMUNITY_REQUESTS.map((item) => (
                <CommunityRequestCard key={item.id} request={item} />
              ))}
            </View>
          </MotiView>

          {/* Posted requests */}
          <Text className="mb-3 mt-8 text-lg font-jakartaBold text-ink">
            Your requests
          </Text>

          {requests.length === 0 ? (
            <EmptyState
              icon="🙋"
              tone="violet"
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

type CommunityRequestCardProps = {
  request: CommunityRequest;
};

/**
 * A single mock community request rendered as a soft-surface card. Purely
 * presentational — a navy avatar chip with initials, the request title, a
 * category + urgency badge, and a relative time.
 */
function CommunityRequestCard({ request }: CommunityRequestCardProps) {
  const label = useMemo(
    () => categoryLabel(request.category),
    [request.category]
  );

  return (
    <View
      style={shadows.soft}
      className="mb-3 flex-row items-start rounded-2xl bg-surface p-4"
    >
      {/* Navy avatar chip with the student's initials. */}
      <View
        style={{ backgroundColor: colors.navy }}
        className="mr-3 h-10 w-10 items-center justify-center rounded-full"
      >
        <Text className="text-xs font-jakartaBold text-white">
          {request.initials}
        </Text>
      </View>

      <View className="flex-1">
        <Text className="text-base font-jakartaSemibold text-ink">
          {request.title}
        </Text>

        <View className="mt-2 flex-row flex-wrap items-center gap-2">
          {label ? <Badge label={label} tone="category" /> : null}
          <UrgencyBadge urgency={request.urgency} />
        </View>

        <Text className="mt-2 text-xs font-jakartaMedium text-subtle">
          {request.timeAgo}
        </Text>
      </View>
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

  // Defensive default: requests persisted before urgency existed lack the field.
  const urgency: NeedUrgency = request.urgency ?? "normal";

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

          <View className="mt-2 flex-row flex-wrap items-center gap-2">
            {label ? <Badge label={label} tone="category" /> : null}
            <UrgencyBadge urgency={urgency} />
          </View>

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
