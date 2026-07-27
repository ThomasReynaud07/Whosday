import * as ImagePicker from "expo-image-picker";
import { supabase } from "./supabase";

const BUCKET = "media";

// Minimal base64 -> Uint8Array decoder (no extra dependency). ImagePicker can
// return the image already base64-encoded, which uploads reliably in RN
// (Blob uploads are unreliable on React Native).
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

function base64ToBytes(b64) {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  const len = Math.floor((clean.length * 3) / 4);
  const bytes = new Uint8Array(len);
  let buffer = 0;
  let bits = 0;
  let p = 0;
  for (let i = 0; i < clean.length; i++) {
    buffer = (buffer << 6) | LOOKUP[clean.charCodeAt(i)];
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[p++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
}

// Opens the photo library and returns the picked asset (with .base64), or null
// if cancelled. `square` crops to a square + shows the editor (for avatars);
// message images are picked full-size (no editor - the iOS crop UI misbehaves
// for non-square images).
export async function pickImage() {
  // Show the iOS "allow photo access" prompt. PHPicker works even without full
  // access, so we don't block if the user limits/denies it.
  try {
    await ImagePicker.requestMediaLibraryPermissionsAsync();
  } catch {
    // ignore - picking still works via PHPicker
  }
  // allowsEditing: true makes iOS re-encode the picked photo to JPEG (iPhones
  // store photos as HEIC, which WhatsApp/WAHA can't decode -> "unsupported
  // image format" / undownloadable media). The editor also crops to a square.
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.7,
    base64: true,
  });
  if (result.canceled) return null;
  return result.assets?.[0] ?? null;
}

// Uploads a picked asset to the public bucket at `path` and returns its public
// URL. `path` must start with the user's id folder (Storage RLS enforces it).
export async function uploadImage(asset, path) {
  if (!asset?.base64) throw new Error("No image data");
  const bytes = base64ToBytes(asset.base64);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
  // Clean URL (no query string): a "?v=" suffix breaks WAHA's file-extension
  // detection when sending media. Paths are already unique per upload.
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
