import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";
import { fetchProfile } from "@/services/authService";
import type { AuthStatus, Profile } from "@/types";

/**
 * Zustand store holding client/UI auth state (design §1.2.1: Zustand owns
 * ephemeral client state; TanStack Query owns the server cache). The Supabase
 * JWT session itself is persisted by the supabase client (lib/supabase.ts:
 * AsyncStorage on native, localStorage on web) — this store is the in-memory,
 * reactive view used by the auth gate and screens.
 */

/**
 * Derive the auth-gate status from the current session + profile (Req 6, 2.1):
 *  - no session                                   → unauthenticated
 *  - session + verified_student + campus_id       → authenticated (full access)
 *  - session but profile incomplete (no row, no   → onboarding
 *    campus_id, or verified_student=false)
 */
export function deriveStatus(
  hasSession: boolean,
  profile: Profile | null
): AuthStatus {
  if (!hasSession) return "unauthenticated";
  if (profile && profile.verified_student && profile.campus_id) {
    return "authenticated";
  }
  return "onboarding";
}

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  status: AuthStatus;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setStatus: (status: AuthStatus) => void;
  /**
   * Re-read the current session + profile from Supabase and recompute status.
   * Used by the onboarding screen's "Refresh" action so a student who has just
   * had their profile finalized server-side (handle_new_user trigger) can pull
   * the updated campus/verified state without signing out and back in.
   */
  refresh: () => Promise<void>;
  reset: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  profile: null,
  status: "loading",
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setStatus: (status) => set({ status }),
  refresh: async () => {
    if (__DEV__) console.log("[authStore] refresh: re-reading session + profile");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const profile = session ? await fetchProfile() : null;
    if (__DEV__) {
      console.log("[authStore] refresh result:", {
        userId: session?.user?.id ?? null,
        hasProfile: profile != null,
        campusId: profile?.campus_id ?? null,
        verifiedStudent: profile?.verified_student ?? false,
      });
    }
    set({ session, profile, status: deriveStatus(session != null, profile) });
  },
  reset: () => set({ session: null, profile: null, status: "unauthenticated" }),
}));
