import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Need It store (Zustand v5) holding a LOCAL-ONLY list of "Need It" requests —
 * things the student is looking for and hopes their campus can help with.
 *
 * This is purely client-side state persisted to the device via AsyncStorage —
 * it is NOT synced to any backend and does not touch the database, RLS, or
 * auth. It mirrors the ephemeral-client-state pattern used by
 * `stores/wishlistStore.ts` (design §1.2.1: Zustand owns ephemeral UI state).
 *
 * // TODO(backend): persist Need It requests server-side (a requests table +
 * // RLS, campus-scoped) and support responses/matching. For now requests live
 * // only on this device.
 */

/**
 * How urgently a student needs the requested item. Purely presentational —
 * drives the urgency chip/badge accent on the Need It board.
 */
export type NeedUrgency = "low" | "normal" | "urgent";

/** A single locally-stored "Need It" request. */
export type NeedRequest = {
  id: string;
  title: string;
  category: string | null;
  note?: string;
  /**
   * Urgency accent. Defaults to "normal" when a request is added without one.
   * Requests persisted before urgency existed won't have this field, so
   * consumers should treat a missing value as "normal" defensively.
   */
  urgency: NeedUrgency;
  createdAt: number;
};

type NeedItState = {
  /** Posted requests. Newest-first (new requests are prepended). */
  requests: NeedRequest[];
  /**
   * Add a new request to the front of the list. `urgency` is optional and
   * defaults to "normal" so existing callers keep working unchanged.
   */
  add: (input: {
    title: string;
    category: string | null;
    note?: string;
    urgency?: NeedUrgency;
  }) => void;
  /** Remove a request by id (no-op if absent). */
  remove: (id: string) => void;
  /** Clear all requests. */
  clear: () => void;
};

/** Generate a collision-resistant local id (no backend id generation yet). */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useNeedItStore = create<NeedItState>()(
  persist(
    (set) => ({
      requests: [],
      add: (input) =>
        set((state) => {
          const request: NeedRequest = {
            id: generateId(),
            title: input.title,
            category: input.category,
            note: input.note,
            // Default to "normal" when omitted so callers/persisted data
            // without an urgency stay valid.
            urgency: input.urgency ?? "normal",
            createdAt: Date.now(),
          };
          return { requests: [request, ...state.requests] };
        }),
      remove: (id) =>
        set((state) => ({
          requests: state.requests.filter((request) => request.id !== id),
        })),
      clear: () => set({ requests: [] }),
    }),
    {
      name: "campuswap.needit",
      // Persist to the device via AsyncStorage. Hydration is asynchronous and
      // non-blocking — the store starts empty and fills in once AsyncStorage
      // resolves.
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the requests array; actions are recreated on each launch.
      partialize: (state) => ({ requests: state.requests }),
    }
  )
);
