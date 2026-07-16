import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Switch, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import {
  Bell,
  ChevronLeft,
  GraduationCap,
  Info,
  LogOut,
  Mail,
  User,
} from "lucide-react-native";

import { Button } from "@/components/Button";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { colors, shadows } from "@/lib/theme";
import { supabase } from "@/lib/supabase";
import { signOut } from "@/services/authService";
import { useAuthStore } from "@/stores/authStore";

/**
 * Settings screen (frontend-only stack route — NOT a tab).
 *
 * // TODO(auth): reads the acting user from `useAuthStore().profile`. Auth is
 * // intentionally paused for this slice — this screen NEVER mocks/fabricates a
 * // user. When `profile` is null we render a graceful placeholder.
 *
 * Purely presentational apart from the read-only campus-name lookup (mirrors
 * the feed/profile pattern) and the sign-out action, which reuses the existing
 * `signOut()` service + `authStore.reset()` exactly as the feed header does.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const profile = useAuthStore((s) => s.profile);

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
        <Text className="text-xl font-jakartaBold text-ink">Settings</Text>
      </View>

      {profile ? (
        <SettingsContent
          displayName={
            profile.display_name ?? profile.email.split("@")[0] ?? "Student"
          }
          email={profile.email}
          campusId={profile.campus_id}
        />
      ) : (
        <EmptyState
          icon="⚙️"
          title="Sign in to manage settings"
          subtitle="Your account and preferences will appear here once you're signed in."
        />
      )}
    </View>
  );
}

type SettingsContentProps = {
  displayName: string;
  email: string;
  campusId: string | null;
};

/** Renders the settings sections for a present profile. */
function SettingsContent({
  displayName,
  email,
  campusId,
}: SettingsContentProps) {
  const router = useRouter();

  const [campusName, setCampusName] = useState<string | null>(null);
  const [campusLoading, setCampusLoading] = useState(false);

  // Local-only preference toggles.
  // TODO(backend): persist notification preferences.
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(false);

  const [signingOut, setSigningOut] = useState(false);

  // Resolve the assigned campus name — same read-only pattern as the feed /
  // profile headers (design §4.2).
  useEffect(() => {
    let active = true;
    (async () => {
      if (!campusId) {
        if (active) {
          setCampusName(null);
          setCampusLoading(false);
        }
        return;
      }
      if (active) setCampusLoading(true);
      const { data: campus } = await supabase
        .from("campuses")
        .select("name")
        .eq("id", campusId)
        .maybeSingle();
      if (!active) return;
      setCampusName((campus?.name as string | undefined) ?? null);
      setCampusLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [campusId]);

  // Mirrors the feed header sign-out: clear the session then reset the store;
  // the auth gate handles routing back to (auth)/email. Behavior unchanged.
  async function onSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
      useAuthStore.getState().reset();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <ScrollView
      contentContainerClassName="px-4 pb-10 pt-2"
      showsVerticalScrollIndicator={false}
    >
      {/* Account */}
      <SectionLabel>Account</SectionLabel>
      <Card>
        <InfoRow
          icon={<User size={18} color={colors.muted} />}
          label="Name"
          value={displayName}
        />
        <Divider />
        <InfoRow
          icon={<Mail size={18} color={colors.muted} />}
          label="Email"
          value={email}
        />
        <Divider />
        <InfoRow
          icon={<GraduationCap size={18} color={colors.muted} />}
          label="Campus"
          value={campusName ?? "—"}
          loading={campusLoading}
        />
      </Card>

      {/* Preferences — local-only toggles (no backend). */}
      <SectionLabel>Preferences</SectionLabel>
      <Card>
        <ToggleRow
          icon={<Bell size={18} color={colors.muted} />}
          label="Push notifications"
          value={pushEnabled}
          onValueChange={setPushEnabled}
        />
        <Divider />
        <ToggleRow
          icon={<Mail size={18} color={colors.muted} />}
          label="Email updates"
          value={emailEnabled}
          onValueChange={setEmailEnabled}
        />
      </Card>

      {/* About */}
      <SectionLabel>About</SectionLabel>
      <Card>
        <InfoRow
          icon={<Info size={18} color={colors.muted} />}
          label="App version"
          value="1.0.0"
        />
        <Divider />
        <InfoRow
          icon={<Info size={18} color={colors.muted} />}
          label="About CampusSwap"
          value="Swap, don't shop 🌱"
        />
      </Card>

      {/* Sign out — reuses the existing signOut() + reset() flow. */}
      <View className="mt-8">
        <Button
          variant="outline"
          size="lg"
          fullWidth
          loading={signingOut}
          onPress={onSignOut}
          icon={<LogOut size={18} color={colors.danger.text} />}
        >
          <Text className="text-base font-jakartaBold text-danger-text">
            Sign out
          </Text>
        </Button>
      </View>
    </ScrollView>
  );
}

/** Uppercase section heading above each card. */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-2 mt-6 text-xs font-jakartaSemibold uppercase tracking-wide text-subtle">
      {children}
    </Text>
  );
}

/** Rounded surface card wrapper with a soft shadow. */
function Card({ children }: { children: ReactNode }) {
  return (
    <View
      style={shadows.soft}
      className="overflow-hidden rounded-2xl bg-surface"
    >
      {children}
    </View>
  );
}

/** Hairline divider between rows. */
function Divider() {
  return <View className="ml-14 h-px bg-borderLight" />;
}

type InfoRowProps = {
  icon: ReactNode;
  label: string;
  value: string;
  loading?: boolean;
};

/** Read-only row: leading icon, label on the left, value on the right. */
function InfoRow({ icon, label, value, loading }: InfoRowProps) {
  return (
    <View className="flex-row items-center px-4 py-3.5">
      <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-borderLight">
        {icon}
      </View>
      <Text className="text-sm font-jakartaMedium text-muted">{label}</Text>
      <View className="ml-auto max-w-[55%]">
        {loading ? (
          <Skeleton width={90} height={12} />
        ) : (
          <Text
            className="text-sm font-jakartaSemibold text-ink"
            numberOfLines={1}
          >
            {value}
          </Text>
        )}
      </View>
    </View>
  );
}

type ToggleRowProps = {
  icon: ReactNode;
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
};

/** Preference row with a native Switch bound to LOCAL state only. */
function ToggleRow({ icon, label, value, onValueChange }: ToggleRowProps) {
  return (
    <View className="flex-row items-center px-4 py-2.5">
      <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-borderLight">
        {icon}
      </View>
      <Text className="text-sm font-jakartaMedium text-ink">{label}</Text>
      <View className="ml-auto">
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.surface}
        />
      </View>
    </View>
  );
}
