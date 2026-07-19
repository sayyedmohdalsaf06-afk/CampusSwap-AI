import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { MotiView } from "moti";
import {
  Bookmark,
  CheckCircle2,
  ChevronLeft,
  Heart,
  Megaphone,
  MessageCircle,
  Sparkles,
} from "lucide-react-native";

import { EmptyState } from "@/components/EmptyState";
import { NotificationCardSkeleton } from "@/components/Skeletons";
import { colors, shadows } from "@/lib/theme";

/**
 * Notifications screen (frontend-only stack route — NOT a tab).
 *
 * This screen is PURELY presentational: it renders a LOCAL, hard-coded mock
 * list of notifications held in component state. There is NO backend, no
 * realtime subscription, and no push wiring of any kind.
 *
 * // TODO(backend): replace the local mock with a campus-scoped notifications
 * // feed (a notifications table + RLS) and wire realtime/read-state sync.
 * // Read/unread toggling here mutates LOCAL state only.
 */

/** The visual "accent" a notification's icon chip + unread cue is tinted with. */
type NotificationAccent = "violet" | "green" | "navy";

type NotificationType =
  | "like"
  | "reservation"
  | "request"
  | "message"
  | "system";

type AppNotification = {
  id: string;
  type: NotificationType;
  /** The person/source that triggered it (bolded in the message). */
  actor: string;
  /** Full message; `actor` is expected to appear at the start. */
  message: string;
  /** Epoch ms in the past — drives the relative timestamp. */
  createdAt: number;
  read: boolean;
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * LOCAL mock feed (device-only, never synced). Varied `createdAt` offsets give
 * a realistic "3m / 40m / 5h / 1d / 3d ago" spread. Mixed read/unread so the
 * "New" / "Earlier" grouping and "Mark all read" both have something to show.
 */
const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    type: "like",
    actor: "Aman",
    message: "Aman liked your listing",
    createdAt: Date.now() - 3 * MINUTE,
    read: false,
  },
  {
    id: "n2",
    type: "reservation",
    actor: "Your bicycle",
    message: "Your bicycle listing was reserved",
    createdAt: Date.now() - 40 * MINUTE,
    read: false,
  },
  {
    id: "n3",
    type: "message",
    actor: "Priya",
    message: "Priya sent you a message",
    createdAt: Date.now() - 5 * HOUR,
    read: false,
  },
  {
    id: "n4",
    type: "request",
    actor: "New book request",
    message: "New book request near you",
    createdAt: Date.now() - 1 * DAY,
    read: true,
  },
  {
    id: "n5",
    type: "system",
    actor: "Study Lamp",
    message: "Your listing 'Study Lamp' is trending",
    createdAt: Date.now() - 3 * DAY,
    read: true,
  },
];

/**
 * Short relative timestamp: "just now", "5m", "3h", "2d", "1w". Mirrors the
 * helper in app/(tabs)/needit.tsx (sans the " ago" suffix, per the compact
 * notification-row style).
 */
function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

/** Per-accent chip + icon colors, all drawn from existing theme tokens. */
const ACCENT_STYLES: Record<
  NotificationAccent,
  { chip: string; iconColor: string }
> = {
  violet: { chip: "bg-violet-bg", iconColor: colors.violet.base },
  green: { chip: "bg-green-50", iconColor: colors.primary },
  navy: { chip: "bg-borderLight", iconColor: colors.ink },
};

/** Maps a notification type → its icon + accent. */
function iconFor(type: NotificationType): {
  Icon: typeof Heart;
  accent: NotificationAccent;
} {
  switch (type) {
    case "like":
      return { Icon: Heart, accent: "violet" };
    case "reservation":
      return { Icon: CheckCircle2, accent: "green" };
    case "request":
      return { Icon: Megaphone, accent: "navy" };
    case "message":
      return { Icon: MessageCircle, accent: "violet" };
    case "system":
      return { Icon: Sparkles, accent: "violet" };
  }
}

export default function NotificationsScreen() {
  const router = useRouter();

  // LOCAL state only — seeded from the mock feed. Read/unread toggling here
  // never touches a backend.
  const [items, setItems] = useState<AppNotification[]>(MOCK_NOTIFICATIONS);
  const [loading, setLoading] = useState(true);

  // Simulate a brief initial load so the skeletons get a moment on screen.
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function markRead(id: string) {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  const hasUnread = useMemo(() => items.some((n) => !n.read), [items]);

  // Split into "New" (unread) then "Earlier" (read) — a nice-to-have grouping.
  const unread = useMemo(() => items.filter((n) => !n.read), [items]);
  const earlier = useMemo(() => items.filter((n) => n.read), [items]);

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header — rounded surface back button (soft shadow) + title, with an
          optional "Mark all read" ghost action on the right. */}
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
        <Text className="text-xl font-jakartaBold text-ink">Notifications</Text>

        {hasUnread ? (
          <Pressable
            onPress={markAllRead}
            accessibilityRole="button"
            accessibilityLabel="Mark all notifications as read"
            className="ml-auto rounded-full px-2 py-1 active:opacity-60"
          >
            <Text className="text-sm font-jakartaSemibold text-violet-text">
              Mark all read
            </Text>
          </Pressable>
        ) : null}
      </View>

      {loading ? (
        // Initial-load skeletons — NotificationCard-shaped placeholders.
        <View className="px-4 pt-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <NotificationCardSkeleton key={i} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          icon="🔔"
          tone="violet"
          title="You're all caught up"
          subtitle="Likes, reservations, and requests will show up here."
          action={{ label: "Browse the feed", onPress: () => router.push("/") }}
        />
      ) : (
        <MotiView
          from={{ opacity: 0, translateY: 8 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 320 }}
          className="flex-1"
        >
          <ScrollView
            contentContainerClassName="px-4 pb-10 pt-2"
            showsVerticalScrollIndicator={false}
          >
            {unread.length > 0 ? (
              <>
                <SectionLabel>New</SectionLabel>
                {unread.map((n) => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    onPress={() => markRead(n.id)}
                  />
                ))}
              </>
            ) : null}

            {earlier.length > 0 ? (
              <>
                <SectionLabel>Earlier</SectionLabel>
                {earlier.map((n) => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    onPress={() => markRead(n.id)}
                  />
                ))}
              </>
            ) : null}
          </ScrollView>
        </MotiView>
      )}
    </View>
  );
}

/** Uppercase section heading above each group. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-2 mt-4 text-xs font-jakartaSemibold uppercase tracking-wide text-subtle">
      {children}
    </Text>
  );
}

type NotificationCardProps = {
  notification: AppNotification;
  onPress: () => void;
};

/**
 * A single notification row inside a soft-shadowed surface card: a tinted
 * rounded-full icon chip, the message (actor bolded) + relative timestamp, and
 * an unread cue (a violet dot + a subtle violet-tinted left accent). Tapping
 * marks it read in LOCAL state.
 */
function NotificationCard({ notification, onPress }: NotificationCardProps) {
  const { Icon, accent } = iconFor(notification.type);
  const accentStyle = ACCENT_STYLES[accent];

  // Split the actor off the front of the message so it can be bolded.
  const startsWithActor = notification.message.startsWith(notification.actor);
  const rest = startsWithActor
    ? notification.message.slice(notification.actor.length)
    : notification.message;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={notification.message}
      style={shadows.soft}
      className={`mb-3 flex-row items-center rounded-2xl p-4 active:opacity-90 ${
        notification.read
          ? "bg-surface"
          : "border-l-2 border-violet-base bg-violet-bg/40"
      }`}
    >
      {/* Icon chip — tinted by the notification's accent. */}
      <View
        className={`h-11 w-11 items-center justify-center rounded-full ${accentStyle.chip}`}
      >
        <Icon size={20} color={accentStyle.iconColor} />
      </View>

      {/* Message + relative timestamp. */}
      <View className="ml-3 flex-1">
        <Text className="text-sm font-jakartaMedium text-ink">
          {startsWithActor ? (
            <Text className="font-jakartaBold text-ink">
              {notification.actor}
            </Text>
          ) : null}
          {rest}
        </Text>
        <Text className="mt-1 text-xs font-jakarta text-subtle">
          {relativeTime(notification.createdAt)}
        </Text>
      </View>

      {/* Unread dot cue. */}
      {!notification.read ? (
        <View className="ml-3 h-2.5 w-2.5 rounded-full bg-violet-base" />
      ) : null}
    </Pressable>
  );
}
