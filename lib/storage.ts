import { supabase } from "./supabase";

/**
 * Supabase Storage preparation for listing images (design §1.2.4, §4.2
 * `listing/create.tsx`). This module is storage *preparation* only: it names
 * the bucket and derives public URLs for rendering. Bucket creation and the
 * Storage RLS policies (owner-only writes under a listing path, authenticated
 * same-campus read) are a LATER task — Task 7.1 — and are intentionally NOT
 * defined here (no bucket, no policies in this file).
 */

/** Name of the Supabase Storage bucket that holds listing image objects. */
export const LISTING_IMAGES_BUCKET = "listing-images";

/**
 * Resolve a `listing_images.storage_path` to a renderable public URL.
 *
 * Uses the Supabase Storage SDK's `getPublicUrl`, which composes the URL
 * locally (no network round-trip). The bucket + read policy that make these
 * URLs resolvable are provisioned in Task 7.1.
 */
export function getListingImageUrl(storagePath: string): string {
  return supabase.storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(storagePath)
    .data.publicUrl;
}
