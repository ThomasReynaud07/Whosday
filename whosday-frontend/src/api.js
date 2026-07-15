import axios from "axios";
import { supabase } from "./supabase";

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
export function friendlyErrorMessage(err) {
  const raw = err?.response?.data?.error || err?.message || String(err);
  if (raw.includes("FREE_LIMIT_REACHED")) {
    return "Tu as atteint la limite du plan gratuit (5 anniversaires). Passe au plan payant pour en ajouter plus.";
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

  async getSettings() {
    const user_id = await currentUserId();
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .eq("user_id", user_id)
      .single();
    if (error) throw error;
    return {
      sendMode: data.send_mode,
      fixedTime: data.fixed_time,
      randomWindowStart: data.random_window_start,
      randomWindowEnd: data.random_window_end,
      todayTargetTime: data.today_target_time,
    };
  },

  async updateSettings(payload) {
    const user_id = await currentUserId();
    const { error } = await supabase
      .from("settings")
      .update({
        send_mode: payload.sendMode,
        fixed_time: payload.fixedTime,
        random_window_start: payload.randomWindowStart,
        random_window_end: payload.randomWindowEnd,
      })
      .eq("user_id", user_id);
    if (error) throw error;
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
