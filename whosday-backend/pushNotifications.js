const axios = require('axios');
const supabaseAdmin = require('./supabaseAdmin');

// Best-effort: a missing/invalid token or a failed push should never break
// the actual WhatsApp send flow that triggered it.
async function notifyUser(userId, title, body) {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('push_token')
      .eq('id', userId)
      .single();
    if (!profile?.push_token) return;

    await axios.post(
      'https://exp.host/--/api/v2/push/send',
      { to: profile.push_token, title, body, sound: 'default' },
      { timeout: 10000, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(`[push] failed for user ${userId}:`, err.message);
  }
}

module.exports = { notifyUser };
