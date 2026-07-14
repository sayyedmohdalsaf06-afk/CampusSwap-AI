import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import type { AuthStatus, Profile } from "@/types";

/**
 * Zustand store holding client/UI auth state (design §1.2.1: Zustand owns
 * ephemeral client state; TanStack Query owns the server cache). The Supabase
 * JWT session itself is persisted in expo-secure-store via the supabase client
 * (lib/supabase.ts) — this store is the in-memory, reactive view used by the
 * auth gate and screens.
 */
type AuthState = {
  session: Session | null;
  profile: Profile | null;
  status: AuthStatus;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setStatus: (status: AuthStatus) => void;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  status: "loading",
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setStatus: (status) => set({ status }),
  reset: () => set({ session: null, profile: null, status: "unauthenticated" }),
}));
