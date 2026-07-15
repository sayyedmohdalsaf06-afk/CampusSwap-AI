import { supabase } from "@/lib/supabase";
import type { ListingType } from "@/types";

/**
 * AI service — thin, typed wrapper over the `ai-generate-listing` Edge Function
 * (design §1.2.1 services/ layer, §1.6 Flow 2). The Gemini API key lives ONLY
 * as an Edge Function secret (design §2.3); this client module never touches a
 * secret and never calls Gemini directly.
 *
 * Resilience (Req 3.7, 8.3, 10.2): every path resolves to a discriminated
 * `{ ok: true, data } | { ok: false }` result — a timeout, network error, or a
 * clean `{ ok: false }` from the function all collapse to `{ ok: false }` so the
 * Create Listing screen can deterministically switch to manual entry and keep
 * publishing.
 */

/** Input for AI listing generation (mirrors the Edge Function contract). */
export type GenerateListingInput = {
  /** Remote (already-uploaded) image URLs; optional. */
  imageUrls?: string[];
  /** Base64-encoded local images (no data: prefix); optional. */
  imageBase64?: string[];
  /** Optional free-text note from the seller. */
  text?: string;
  /** `sell` requests a price suggestion; `donate` omits it (Req 3.4, 3.5). */
  listingType: ListingType;
};

/** AI-suggested, editable listing fields (Req 3.2–3.4, 3.6). */
export type AiListingSuggestion = {
  title: string;
  description: string;
  condition: string;
  /** Suggested price for `sell`; null for `donate` (Req 3.4, 3.5). */
  price: number | null;
};

/** Discriminated result so the screen can fall back cleanly (Req 3.7, 10.2). */
export type GenerateListingResult =
  | { ok: true; data: AiListingSuggestion }
  | { ok: false };

/**
 * Client-side timeout mirroring the Edge Function's 15s bound (Req 3.7, 8.3).
 * Even if the function hangs, the client resolves to `{ ok: false }` so the UI
 * never waits indefinitely on live AI.
 */
const CLIENT_TIMEOUT_MS = 15_000;

/** Narrow an unknown payload into an AiListingSuggestion, or return null. */
function toSuggestion(
  data: unknown,
  listingType: ListingType,
): AiListingSuggestion | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  const title = typeof d.title === "string" ? d.title.trim() : "";
  if (!title) return null;
  const description =
    typeof d.description === "string" ? d.description.trim() : "";
  const condition = typeof d.condition === "string" ? d.condition.trim() : "";
  let price: number | null = null;
  if (listingType === "sell" && typeof d.price === "number" && d.price >= 0) {
    price = d.price;
  }
  return { title, description, condition, price };
}

/**
 * Generate listing suggestions from image(s) + optional text via the
 * `ai-generate-listing` Edge Function. Wrapped with a client-side timeout and
 * total error containment — always resolves, never throws (Req 3.7, 10.2).
 */
export async function generateListing(
  input: GenerateListingInput,
): Promise<GenerateListingResult> {
  const invoke = (async (): Promise<GenerateListingResult> => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "ai-generate-listing",
        { body: input },
      );
      if (error) return { ok: false };
      const payload = data as { ok?: boolean; data?: unknown } | null;
      if (!payload || payload.ok !== true) return { ok: false };
      const suggestion = toSuggestion(payload.data, input.listingType);
      return suggestion ? { ok: true, data: suggestion } : { ok: false };
    } catch {
      return { ok: false };
    }
  })();

  const timeout = new Promise<GenerateListingResult>((resolve) => {
    setTimeout(() => resolve({ ok: false }), CLIENT_TIMEOUT_MS);
  });

  return Promise.race([invoke, timeout]);
}
