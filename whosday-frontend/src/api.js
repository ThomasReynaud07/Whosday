import axios from "axios";
import { supabase } from "./supabase";
import { t } from "./i18n";

// The backend only handles what has to talk to WAHA (not reachable
// directly from the phone). Everything else goes straight to Supabase,
// scoped to the signed-in user by Row Level Security.
//
// Deployed on Fly.io - reachable from anywhere, not just your Wi-Fi.
export const BACKEND_URL = "https://whosday-backend.fly.dev/api";

export async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function currentUserId() {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user?.id;
  if (!id) throw new Error("Not signed in");
  return id;
}

// The free-plan-limit DB trigger raises a message with a stable
// "FREE_LIMIT_REACHED:" prefix (see supabase/0002_push_notifications.sql)
// so it can be turned into a friendly, translated message here instead of
// showing raw Postgres error text.
// Free plan cap - kept in sync with the DB trigger in
// supabase/0002_push_notifications.sql.
export const FREE_LIMIT = 5;

export function isFreeLimitError(err) {
  const raw = err?.response?.data?.error || err?.message || String(err);
  return raw.includes("FREE_LIMIT_REACHED");
}

export function friendlyErrorMessage(err) {
  const raw = err?.response?.data?.error || err?.message || String(err);
  if (isFreeLimitError(err)) {
    return t("err.freeLimit", { limit: FREE_LIMIT });
  }
  return raw;
}

function rowToBirthday(row) {
  return {
    id: row.id,
    name: row.name,
    phoneNumber: row.phone_number,
    month: row.month,
    day: row.day,
    message: row.message,
    sendTime: row.send_time || "09:00",
    birthYear: row.birth_year ?? null,
    photoUrl: row.photo_url ?? null,
    mediaUrl: row.media_url ?? null,
    mediaType: row.media_type ?? null,
    mediaPreviewUrl: row.media_preview_url ?? null,
    createdAt: row.created_at,
  };
}

export const api = {
  async getBirthdays() {
    const { data, error } = await supabase
      .from("birthdays")
      .select("*")
      .order("month", { ascending: true })
      .order("day", { ascending: true });
    if (error) throw error;
    return data.map(rowToBirthday);
  },

  async createBirthday(payload) {
    const user_id = await currentUserId();
    const { data, error } = await supabase
      .from("birthdays")
      .insert({
        user_id,
        name: payload.name,
        phone_number: payload.phoneNumber,
        month: payload.month,
        day: payload.day,
        message: payload.message,
        send_time: payload.sendTime ?? "09:00",
        birth_year: payload.birthYear ?? null,
        photo_url: payload.photoUrl ?? null,
        media_url: payload.mediaUrl ?? null,
        media_type: payload.mediaType ?? null,
        media_preview_url: payload.mediaPreviewUrl ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToBirthday(data);
  },

  async updateBirthday(id, payload) {
    const { data, error } = await supabase
      .from("birthdays")
      .update({
        name: payload.name,
        phone_number: payload.phoneNumber,
        month: payload.month,
        day: payload.day,
        message: payload.message,
        send_time: payload.sendTime,
        birth_year: payload.birthYear,
        photo_url: payload.photoUrl ?? null,
        media_url: payload.mediaUrl ?? null,
        media_type: payload.mediaType ?? null,
        media_preview_url: payload.mediaPreviewUrl ?? null,
        // Re-arm today's send: if you edit a birthday (e.g. change the time),
        // it should be eligible to go out again today instead of staying
        // blocked by the once-a-day guard from an earlier send.
        last_sent_date: null,
      })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return rowToBirthday(data);
  },

  async deleteBirthday(id) {
    const { error } = await supabase.from("birthdays").delete().eq("id", id);
    if (error) throw error;
  },

  async sendBirthday(id) {
    const headers = await authHeader();
    return axios.post(`${BACKEND_URL}/birthdays/${id}/send`, {}, { headers });
  },

  async getProfile() {
    const user_id = await currentUserId();
    const { data, error } = await supabase
      .from("profiles")
      .select("is_pro, pro_expires_at, avatar_url")
      .eq("id", user_id)
      .single();
    if (error) throw error;
    return {
      isPro: Boolean(data.is_pro),
      proExpiresAt: data.pro_expires_at,
      avatarUrl: data.avatar_url ?? null,
    };
  },

  // Save the device's IANA timezone (e.g. "Europe/Zurich") so the backend
  // scheduler sends birthday messages at the user's real local time.
  async syncTimezone() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      const user_id = await currentUserId();
      await supabase.from("profiles").update({ timezone: tz }).eq("id", user_id);
    } catch {
      // best-effort - a missing timezone just falls back to Europe/Paris server-side
    }
  },

  async deleteAccount() {
    const headers = await authHeader();
    await axios.post(`${BACKEND_URL}/account/delete`, {}, { headers });
    await supabase.auth.signOut();
  },

  async updateAvatar(avatarUrl) {
    const user_id = await currentUserId();
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: avatarUrl })
      .eq("id", user_id);
    if (error) throw error;
  },

  currentUserId,

  async generateMessage({ name, tone, lang, prompt }) {
    const headers = await authHeader();
    const { data } = await axios.post(
      `${BACKEND_URL}/generate-message`,
      { name, tone, lang, prompt },
      { headers },
    );
    return data.message;
  },

  async getMessagesSent() {
    const { data, error } = await supabase
      .from("messages_sent")
      .select("*")
      .order("sent_at", { ascending: false });
    if (error) throw error;
    return data;
  },
};
