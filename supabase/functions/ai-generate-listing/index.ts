// CampusSwap AI — Task 7.2: `ai-generate-listing` Edge Function (Gemini proxy)
//
// Deno / TypeScript Supabase Edge Function. Proxies listing photos + optional
// text to Gemini 2.5 Flash and returns strict JSON suggestions for a new
// listing. See design.md §1.2.6 (AI Architecture), §2.3 (Gemini API Key
// Protection), and Flow 2 (§1.6); Requirements 3.2–3.4, 3.7, 8.3, 10.2, 16.4.
//
// ─────────────────────────────────────────────────────────────────────────────
// SECRET MANAGEMENT (design §2.3, §4.5):
//   GEMINI_API_KEY is read from Deno.env and MUST be configured as a function
//   secret — it is NEVER shipped in the client bundle:
//       supabase secrets set GEMINI_API_KEY=your_key_here
//   All Gemini calls go ONLY through this Edge Function; the React Native client
//   never talks to Gemini directly.
// ─────────────────────────────────────────────────────────────────────────────
//
// Resilience (Req 3.7, 8.3, 10.2): a 15s timeout (AbortController) bounds the
// Gemini call; any failure returns a clean `{ ok: false }` shape so the client
// can deterministically fall back to manual entry and keep publishing.

import { GoogleGenerativeAI } from "https://esm.sh/@google/generative-ai@0.21.0";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TIMEOUT_MS = 15_000;

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ListingType = "sell" | "donate";

type GenerateInput = {
  imageUrls?: string[];
  imageBase64?: string[];
  text?: string;
  listingType: ListingType;
};

type GeneratedListing = {
  title: string;
  description: string;
  condition: string;
  price: number | null;
};

// ── Basic per-user, in-memory rate-limit guard ──────────────────────────────
// TODO(scale): this is a best-effort in-memory guard scoped to a single warm
// instance — replace with a durable per-user limiter (e.g. a Postgres/Upstash
// counter) when scaling across many campuses (design §2.3 per-user rate limit).
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 8;
const rateBuckets = new Map<string, number[]>();

function isRateLimited(userKey: string): boolean {
  const now = Date.now();
  const hits = (rateBuckets.get(userKey) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS,
  );
  hits.push(now);
  rateBuckets.set(userKey, hits);
  return hits.length > RATE_LIMIT_MAX;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** Fetch a remote image URL and return a base64 inlineData part for Gemini. */
async function urlToInlinePart(
  url: string,
  signal: AbortSignal,
): Promise<{ inlineData: { data: string; mimeType: string } } | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type") ?? "image/jpeg";
    const buf = new Uint8Array(await res.arrayBuffer());
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    return { inlineData: { data: btoa(binary), mimeType } };
  } catch {
    return null;
  }
}

/** Coerce Gemini's text output into a strict GeneratedListing (or null). */
function parseGenerated(
  raw: string,
  listingType: ListingType,
): GeneratedListing | null {
  // Gemini may wrap JSON in ```json fences — strip them defensively.
  const cleaned = raw
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;

  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }

  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  const description =
    typeof obj.description === "string" ? obj.description.trim() : "";
  const condition =
    typeof obj.condition === "string" ? obj.condition.trim() : "";
  if (!title) return null;

  // price only for `sell`; null for `donate` (Req 3.4, 3.5).
  let price: number | null = null;
  if (listingType === "sell") {
    const p =
      typeof obj.price === "number"
        ? obj.price
        : Number.parseFloat(String(obj.price ?? ""));
    price = Number.isFinite(p) && p >= 0 ? p : null;
  }

  return { title, description, condition, price };
}

Deno.serve(async (req: Request) => {
  // CORS preflight.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ ok: false, error: "method_not_allowed" }, 405);
  }

  // Require an authenticated caller (a bearer token). The token is verified by
  // the Supabase Functions gateway; here we only require its presence and use
  // it as the rate-limit key (design §2.3 — authenticated, verified caller).
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  const userKey = authHeader.slice(7).trim().slice(-32) || "anon";
  if (isRateLimited(userKey)) {
    return json({ ok: false, error: "rate_limited" }, 429);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    // Missing secret → clean failure so the client falls back to manual entry.
    return json({ ok: false, error: "ai_unavailable" });
  }

  let input: GenerateInput;
  try {
    input = (await req.json()) as GenerateInput;
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  const listingType: ListingType =
    input.listingType === "donate" ? "donate" : "sell";

  // 15s timeout bounding the whole Gemini interaction (Req 3.7, 8.3, 10.2).
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    // Assemble multimodal parts: images (base64 inline or fetched URLs) + text.
    const parts: unknown[] = [];

    for (const b64 of input.imageBase64 ?? []) {
      if (typeof b64 === "string" && b64.length > 0) {
        parts.push({ inlineData: { data: b64, mimeType: "image/jpeg" } });
      }
    }
    for (const url of input.imageUrls ?? []) {
      const part = await urlToInlinePart(url, controller.signal);
      if (part) parts.push(part);
    }

    const priceInstruction =
      listingType === "sell"
        ? 'Include a fair second-hand "price" as a positive number in INR (no currency symbol).'
        : 'This is a donation: set "price" to null.';

    const prompt =
      `You are helping a university student create a second-hand marketplace listing. ` +
      `Analyze the provided image(s)${input.text ? " and the seller's note" : ""} ` +
      `and respond with STRICT JSON only (no prose, no markdown) matching exactly: ` +
      `{"title": string, "description": string, "condition": string, "price": number|null}. ` +
      `"title" is a concise item name. "description" is 1-2 friendly sentences. ` +
      `"condition" is one of: New, Like New, Good, Fair, Poor. ${priceInstruction}` +
      (input.text ? ` Seller's note: ${input.text}` : "");

    parts.push({ text: prompt });

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

    const result = await model.generateContent(
      { contents: [{ role: "user", parts: parts as never }] },
      { signal: controller.signal } as never,
    );

    const text = result.response.text();
    const parsed = parseGenerated(text, listingType);
    if (!parsed) return json({ ok: false, error: "ai_parse_failed" });

    return json({ ok: true, data: parsed });
  } catch (_err) {
    // Timeout/abort or any Gemini/network error → clean fallback signal.
    return json({ ok: false, error: "ai_error" });
  } finally {
    clearTimeout(timeout);
  }
});
