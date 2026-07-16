import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { ChevronLeft, Send } from "lucide-react-native";

import { EmptyState } from "@/components/EmptyState";
import { colors, shadows } from "@/lib/theme";

/**
 * Chat / Messages placeholder (frontend-only stack route — NOT a tab).
 *
 * This is a static "coming soon" screen. There is no messaging backend yet —
 * buyers and sellers coordinate pickup offline after reserving. The decorative
 * conversation rows and disabled input bar below are purely presentational to
 * hint at the future UI; nothing here reads or writes any data.
 *
 * // TODO(backend): realtime messaging (Supabase Realtime channels) —
 * // placeholder only. Wire up conversations, message history, and the input
 * // bar when the messaging backend lands.
 */

/** Decorative mock conversations — purely visual, greyed out, non-interactive. */
const MOCK_CONVERSATIONS = [
  { id: "m1", name: "Aarav S.", preview: "Is the calculator still available?", initials: "AS" },
  { id: "m2", name: "Meera K.", preview: "Great, see you at the library at 5!", initials: "MK" },
  { id: "m3", name: "Rohan P.", preview: "Thanks for the textbook 🙌", initials: "RP" },
];

export default function ChatScreen() {
  const router = useRouter();

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />

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

      <ScrollView
        contentContainerClassName="px-4 pb-10"
        showsVerticalScrollIndicator={false}
      >
        <EmptyState
          icon="💬"
          title="Messaging is coming soon"
          subtitle="For now, buyers and sellers coordinate pickup offline after reserving an item. In-app chat will land here soon."
        />

        {/* Decorative preview of the future conversation list. */}
        <Text className="mb-3 mt-2 text-xs font-jakartaSemibold uppercase tracking-wide text-subtle">
          Preview
        </Text>
        <View className="opacity-40">
          {MOCK_CONVERSATIONS.map((conversation) => (
            <View
              key={conversation.id}
              style={shadows.soft}
              className="mb-3 flex-row items-center rounded-2xl bg-surface p-4"
            >
              <View className="mr-3 h-11 w-11 items-center justify-center rounded-full bg-green-50">
                <Text className="text-sm font-jakartaExtrabold text-green-700">
                  {conversation.initials}
                </Text>
              </View>
              <View className="flex-1">
                <Text className="text-sm font-jakartaSemibold text-ink">
                  {conversation.name}
                </Text>
                <Text
                  className="mt-0.5 text-sm font-jakarta text-muted"
                  numberOfLines={1}
                >
                  {conversation.preview}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Disabled message input bar — decorative, submits nowhere. */}
      <View className="border-t border-borderLight bg-surface px-4 pb-8 pt-3">
        <View className="flex-row items-center opacity-40">
          <View className="flex-1 rounded-2xl border border-border bg-bg px-4 py-3">
            <TextInput
              className="text-base font-jakarta text-ink"
              placeholder="Messaging coming soon…"
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
  );
}
