import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/**
 * Wishlist store (Zustand v5) holding a LOCAL-ONLY set of saved listing ids.
 *
 * This is a purely client-side "save for later" list persisted to the device
 * via AsyncStorage — it is NOT synced to any backend and does not touch the
 * database, RLS, or auth. It mirrors the ephemeral-client-state pattern used by
 * `stores/authStore.ts` (design §1.2.1: Zustand owns ephemeral UI state).
 *
 * // TODO(backend): persist wishlist server-side (e.g. a wishlists table + RLS)
 * // and sync across devices. For now the wishlist lives only on this device.
 */

type WishlistState = {
  /** Saved listing ids. Order is insertion order (newest appended). */
  ids: string[];
  /** Toggle a listing id on/off the wishlist. */
  toggle: (id: string) => void;
  /** Add a listing id (no-op if already present). */
  add: (id: string) => void;
  /** Remove a listing id (no-op if absent). */
  remove: (id: string) => void;
  /** Whether a listing id is currently saved. */
  has: (id: string) => boolean;
  /** Clear the entire wishlist. */
  clear: () => void;
};

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set((state) =>
          state.ids.includes(id)
            ? { ids: state.ids.filter((existing) => existing !== id) }
            : { ids: [...state.ids, id] }
        ),
      add: (id) =>
        set((state) =>
          state.ids.includes(id) ? state : { ids: [...state.ids, id] }
        ),
      remove: (id) =>
        set((state) => ({
          ids: state.ids.filter((existing) => existing !== id),
        })),
      has: (id) => get().ids.includes(id),
      clear: () => set({ ids: [] }),
    }),
    {
      name: "campuswap.wishlist",
      // Persist to the device via AsyncStorage. Hydration is asynchronous and
      // non-blocking — the store starts with an empty list and fills in once
      // AsyncStorage resolves.
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the ids array; actions are recreated on each launch.
      partialize: (state) => ({ ids: state.ids }),
    }
  )
);
