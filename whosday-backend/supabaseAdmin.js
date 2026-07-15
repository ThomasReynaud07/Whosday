const { createClient } = require('@supabase/supabase-js');

// service_role bypasses Row Level Security - only ever used server-side,
// so the cron can read every user's data and log sends on their behalf.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = supabaseAdmin;
