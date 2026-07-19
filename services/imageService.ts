import * as ImagePicker from "expo-image-picker";

import { LISTING_IMAGES_BUCKET } from "@/lib/storage";
import { supabase } from "@/lib/supabase";

/**
 * Image service — image picking + Supabase Storage upload for listing images
 * (design §1.2.4 Storage Architecture, §2.6 Storage Security; Req 3.8, 9.1,
 * 10.2). Screens never call expo-image-picker or the Storage SDK directly; they
 * go through these typed helpers.
 */

/** Client-side upload guards (server-side validation is enforced too, §2.6). */
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;

/** A locally picked image asset (subset of expo-image-picker's asset shape). */
export type PickedImage = {
  uri: string;
  mimeType?: string | null;
  fileSize?: number | null;
  width?: number;
  height?: number;
};

/**
 * Prompt for media-library permission and let the seller pick one or more
 * images (Req 3.8). Returns an empty array when permission is denied or the
 * picker is cancelled (callers treat this as "no change").
 */
export async function pickImages(
  options: { multiple?: boolean } = {},
): Promise<PickedImage[]> {
  const permission =
    await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: options.multiple ?? true,
    quality: 0.8,
  });
  if (result.canceled) return [];

  return result.assets.map((a) => ({
    uri: a.uri,
    mimeType: a.mimeType,
    fileSize: a.fileSize,
    width: a.width,
    height: a.height,
  }));
}

/** Map a MIME type to a file extension for the storage object key. */
function extensionFor(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

/** Lightweight unique id for the object key (avoids an extra crypto dep). */
function uniqueId(): string {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/** Assert an asset passes the client-side MIME/size guard (§2.6). */
function assertAllowed(asset: PickedImage): string {
  const mime = asset.mimeType ?? "image/jpeg";
  if (!ALLOWED_MIME.includes(mime as (typeof ALLOWED_MIME)[number])) {
    throw new Error("Unsupported image type. Use JPEG, PNG, or WebP.");
  }
  if (asset.fileSize != null && asset.fileSize > MAX_IMAGE_BYTES) {
    throw new Error("Image is too large (max 8 MB).");
  }
  return mime;
}

/**
 * Read a local image asset into base64 (no `data:` prefix) for the AI
 * generation request (design §1.6 Flow 2 — the AI proxy accepts inline base64).
 */
export async function assetToBase64(asset: PickedImage): Promise<string> {
  const res = await fetch(asset.uri);
  const blob = await res.blob();
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
  // strip the leading `data:<mime>;base64,` prefix
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

/**
 * Upload a single picked image to the `listing-images` bucket under the owner
 * path `${userId}/${listingId}/${uuid}.<ext>` and return its `storage_path`
 * (design §2.6 — Storage RLS requires the first path segment == the caller's
 * uid). The returned path is what gets stored in a `listing_images` row.
 *
 * // TODO(auth): `userId` is expected to be the CURRENT authenticated, verified
 * // user's id (the future auth system will populate `authStore.profile.id`).
 * // The Storage RLS policy (Task 7.1) enforces that the first path segment
 * // equals `auth.uid()`, so a mismatched userId will be rejected server-side.
 */
export async function uploadListingImage(
  userId: string,
  listingId: string,
  asset: PickedImage,
): Promise<string> {
  const mime = assertAllowed(asset);
  const path = `${userId}/${listingId}/${uniqueId()}.${extensionFor(mime)}`;

  const res = await fetch(asset.uri);
  const arrayBuffer = await res.arrayBuffer();

  const { error } = await supabase.storage
    .from(LISTING_IMAGES_BUCKET)
    .upload(path, arrayBuffer, { contentType: mime, upsert: false });

  if (error) throw error;
  return path;
}
