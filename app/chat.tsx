import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { ChevronLeft, Send } from "lucide-react-native";
import { MotiView } from "moti";

import { EmptyState } from "@/components/EmptyState";
import { colors, shadows } from "@/lib/theme";

/**
 * Chat / Messages (frontend-only stack route — NOT a tab).
 *
 * A single-screen chat experience driven entirely by LOCAL component state and
 * mock data — there is no messaging backend, realtime, or push wired up here.
 * `activeId` toggles between two views:
 *   - `null`            → the CONVERSATION LIST.
 *   - a conversation id → the THREAD for that conversation.
 *
 * Everything is presentational: the input bar is disabled and nothing here
 * reads or writes any real data.
 *
 * // TODO(backend): realtime messaging (Supabase Realtime channels) —
 * // placeholder only. Wire up conversations, message history, and the input
 * // bar when the messaging backend lands.
 */

/** A single conversation row in the list. */
type Conversation = {
  id: string;
  name: string;
  initials: string;
  preview: string;
  time: string;
  unread: number;
  online: boolean;
};

/** A single message bubble within a thread. */
type Message = {
  id: string;
  text: string;
  mine: boolean;
  time: string;
};

/** Mock conversation list — purely visual, no backend. */
const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "m1",
    name: "Aarav S.",
    initials: "AS",
    preview: "Is the graphing calculator still available?",
    time: "2m",
    unread: 2,
    online: true,
  },
  {
    id: "m2",
    name: "Meera K.",
    initials: "MK",
    preview: "Perfect, see you at the library steps at 5!",
    time: "18m",
    unread: 0,
    online: true,
  },
  {
    id: "m3",
    name: "Rohan P.",
    initials: "RP",
    preview: "Thanks for the textbook — really appreciate it 🙌",
    time: "1h",
    unread: 0,
    online: false,
  },
  {
    id: "m4",
    name: "Priya N.",
    initials: "PN",
    preview: "Could you hold the desk lamp until tomorrow?",
    time: "Yesterday",
    unread: 1,
    online: false,
  },
  {
    id: "m5",
    name: "Dev M.",
    initials: "DM",
    preview: "Sounds good, I'll bring exact change.",
    time: "2d",
    unread: 0,
    online: false,
  },
];

/** Mock message threads keyed by conversation id — short, believable pickups. */
const MOCK_MESSAGES: Record<string, Message[]> = {
  m1: [
    { id: "m1-1", text: "Hey! Is the graphing calculator still available?", mine: false, time: "9:41 AM" },
    { id: "m1-2", text: "Yep, still up for grabs 👍", mine: true, time: "9:42 AM" },
    { id: "m1-3", text: "Awesome. Does it come with the case?", mine: false, time: "9:43 AM" },
    { id: "m1-4", text: "It does — case and the USB cable too.", mine: true, time: "9:44 AM" },
    { id: "m1-5", text: "Perfect. Could we meet near the science block?", mine: false, time: "9:45 AM" },
  ],
  m2: [
    { id: "m2-1", text: "Hi Meera, are you free this evening for the pickup?", mine: true, time: "3:10 PM" },
    { id: "m2-2", text: "Yes! Around 5 works for me.", mine: false, time: "3:12 PM" },
    { id: "m2-3", text: "Great — the library steps?", mine: true, time: "3:13 PM" },
    { id: "m2-4", text: "Perfect, see you at the library steps at 5!", mine: false, time: "3:14 PM" },
  ],
  m3: [
    { id: "m3-1", text: "Handing off the textbook now, I'm by the cafe.", mine: true, time: "Mon" },
    { id: "m3-2", text: "On my way, blue hoodie 🙂", mine: false, time: "Mon" },
    { id: "m3-3", text: "Got it, thanks!", mine: true, time: "Mon" },
    { id: "m3-4", text: "Thanks for the textbook — really appreciate it 🙌", mine: false, time: "Mon" },
  ],
  m4: [
    { id: "m4-1", text: "Hi! Is the desk lamp still available?", mine: false, time: "Yesterday" },
    { id: "m4-2", text: "It is — works great, barely used.", mine: true, time: "Yesterday" },
    { id: "m4-3", text: "Could you hold the desk lamp until tomorrow?", mine: false, time: "Yesterday" },
  ],
  m5: [
    { id: "m5-1", text: "Meeting at the dorm lobby at noon still good?", mine: true, time: "Sat" },
    { id: "m5-2", text: "Works for me.", mine: false, time: "Sat" },
    { id: "m5-3", text: "Sounds good, I'll bring exact change.", mine: false, time: "Sat" },
  ],
};

/** Small looping three-dot "typing" indicator (left-aligned bubble). */
function TypingIndicator({ name }: { name: string }) {
  return (
    <View className="mb-2 items-start">
      <Text className="mb-1 ml-1 text-[10px] font-jakarta text-subtle">
        {name} is typing…
      </Text>
      <View
        style={shadows.soft}
        className="flex-row items-center gap-1.5 rounded-2xl border border-borderLight bg-surface px-4 py-3"
      >
        {[0, 1, 2].map((i) => (
          <MotiView
            key={i}
            from={{ opacity: 0.3, translateY: 0 }}
            animate={{ opacity: 1, translateY: -3 }}
            transition={{
              type: "timing",
              duration: 500,
              loop: true,
              repeatReverse: true,
              delay: i * 160,
            }}
            className="h-2 w-2 rounded-full bg-subtle"
          />
        ))}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  // Local view state: null → conversation list, id → that conversation thread.
  const [activeId, setActiveId] = useState<string | null>(null);

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  const activeConversation = activeId
    ? MOCK_CONVERSATIONS.find((c) => c.id === activeId) ?? null
    : null;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {activeConversation ? (
        /* ============================ THREAD VIEW ============================ */
        <View className="flex-1">
          {/* Header — back returns to the list (local state, not router.back). */}
          <View className="flex-row items-center gap-3 px-4 pb-3 pt-14">
            <Pressable
              onPress={() => setActiveId(null)}
              accessibilityRole="button"
              accessibilityLabel="Back to messages"
              style={shadows.soft}
              className="h-11 w-11 items-center justify-center rounded-2xl bg-surface active:opacity-70"
            >
              <ChevronLeft size={22} color={colors.ink} />
            </Pressable>
            <View className="flex-1">
              <Text className="text-lg font-jakartaBold text-ink" numberOfLines={1}>
                {activeConversation.name}
              </Text>
              <View className="mt-0.5 flex-row items-center gap-1.5">
                {activeConversation.online ? (
                  <View className="h-2 w-2 rounded-full bg-primary" />
                ) : null}
                <Text className="text-xs font-jakarta text-subtle">
                  {activeConversation.online ? "Online" : "Active recently"}
                </Text>
              </View>
            </View>
          </View>

          {/* Message list with a subtle mount fade. */}
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 320 }}
            className="flex-1"
          >
            <ScrollView
              contentContainerClassName="px-4 pb-6 pt-2"
              showsVerticalScrollIndicator={false}
            >
              {(MOCK_MESSAGES[activeConversation.id] ?? []).map((message) => (
                <View
                  key={message.id}
                  className={
                    message.mine ? "mb-2 items-end" : "mb-2 items-start"
                  }
                >
                  <View
                    style={shadows.soft}
                    className={
                      message.mine
                        ? "max-w-[78%] rounded-2xl rounded-br-md bg-navy px-4 py-2.5"
                        : "max-w-[78%] rounded-2xl rounded-bl-md border border-borderLight bg-surface px-4 py-2.5"
                    }
                  >
                    <Text
                      className={
                        message.mine
                          ? "text-[15px] font-jakarta text-white"
                          : "text-[15px] font-jakarta text-ink"
                      }
                    >
                      {message.text}
                    </Text>
                  </View>
                  <Text
                    className={
                      message.mine
                        ? "mr-1 mt-1 text-[10px] font-jakarta text-subtle"
                        : "ml-1 mt-1 text-[10px] font-jakarta text-subtle"
                    }
                  >
                    {message.time}
                  </Text>
                </View>
              ))}

              {/* Animated typing placeholder — purely decorative. */}
              <TypingIndicator name={activeConversation.name} />
            </ScrollView>
          </MotiView>

          {/* Disabled message input bar — decorative, submits nowhere. */}
          <View className="border-t border-borderLight bg-surface px-4 pb-8 pt-3">
            <View className="flex-row items-center opacity-40">
              <View className="flex-1 rounded-2xl border border-border bg-bg px-4 py-3">
                <TextInput
                  className="text-base font-jakarta text-ink"
                  placeholder="Messaging preview — coming soon…"
                  placeholderTextColor={colors.subtle}
                  editable={false}
                />
              </View>
              <View className="ml-3 h-11 w-11 items-center justify-center rounded-2xl bg-primary">
                <Send size={18} color={colors.surface} />
              </View>
            </View>
          </View>
        </View>
      ) : (
        /* ========================= CONVERSATION LIST ========================= */
        <View className="flex-1">
          {/* Header — rounded surface back button (soft shadow) + title. */}
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
            <Text className="text-xl font-jakartaBold text-ink">Messages</Text>
          </View>

          {MOCK_CONVERSATIONS.length === 0 ? (
            <EmptyState
              icon="💬"
              tone="violet"
              title="No messages yet"
              subtitle="When you reserve or list an item, conversations show up here."
              action={{ label: "Browse the feed", onPress: () => router.push("/") }}
            />
          ) : (
            <ScrollView
              contentContainerClassName="px-4 pb-10"
              showsVerticalScrollIndicator={false}
            >
              {/* Tasteful preview note — chat is presentational for now. */}
              <Text className="mb-3 text-xs font-jakarta text-subtle">
                Chat preview — sample conversations shown while messaging is on
                the way.
              </Text>

              {MOCK_CONVERSATIONS.map((conversation) => {
                const hasUnread = conversation.unread > 0;
                return (
                  <Pressable
                    key={conversation.id}
                    onPress={() => setActiveId(conversation.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Open conversation with ${conversation.name}`}
                    style={shadows.soft}
                    className="mb-3 flex-row items-center rounded-2xl bg-surface p-4 active:opacity-80"
                  >
                    {/* Avatar: navy chip + white initials, green online dot. */}
                    <View className="mr-3">
                      <View className="h-12 w-12 items-center justify-center rounded-full bg-navy">
                        <Text className="text-sm font-jakartaExtrabold text-white">
                          {conversation.initials}
                        </Text>
                      </View>
                      {conversation.online ? (
                        <View className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-surface bg-primary" />
                      ) : null}
                    </View>

                    {/* Middle: name + last message preview. */}
                    <View className="flex-1">
                      <Text
                        className={
                          hasUnread
                            ? "font-jakartaBold text-ink"
                            : "font-jakartaSemibold text-ink"
                        }
                        numberOfLines={1}
                      >
                        {conversation.name}
                      </Text>
                      <Text
                        className={
                          hasUnread
                            ? "mt-0.5 text-sm font-jakartaMedium text-muted"
                            : "mt-0.5 text-sm font-jakarta text-muted"
                        }
                        numberOfLines={1}
                      >
                        {conversation.preview}
                      </Text>
                    </View>

                    {/* Right: time + unread badge. */}
                    <View className="ml-3 items-end">
                      <Text className="text-xs font-jakarta text-subtle">
                        {conversation.time}
                      </Text>
                      {hasUnread ? (
                        <View className="mt-1.5 h-5 min-w-[20px] items-center justify-center rounded-full bg-violet-base px-1.5">
                          <Text className="text-[11px] font-jakartaBold text-white">
                            {conversation.unread}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
