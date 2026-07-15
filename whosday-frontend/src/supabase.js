import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://anlimjmnwcjuhrawyuzx.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFubGltam1ud2NqdWhyYXd5dXp4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNjM0NTUsImV4cCI6MjA5OTYzOTQ1NX0.55mX5jqPPv11CdUa5jW6wM9DaZvQFko7HZXpFCndL9E";

// Safe to ship in the app - the anon key only grants what Row Level
// Security policies allow (each user can only ever touch their own rows).
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
