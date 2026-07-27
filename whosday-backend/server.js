require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');

const supabaseAdmin = require('./supabaseAdmin');
const requireAuth = require('./requireAuth');
const { notifyUser } = require('./pushNotifications');
const {
  sendWhatsAppMessage,
  sendWhatsAppImage,
  sendWhatsAppGif,
  deleteSession,
  getSessionStatus,
  startSession,
  restartSession,
  requestPairingCode,
  getQrCode,
} = require('./waha');

const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());

// ---------- helpers ----------
//
// Birthdays/settings/history are read and written straight from the app via
// the Supabase client (Row Level Security keeps each user scoped to their
// own rows). This backend is now only responsible for what has to run
// server-side regardless of whether anyone's app is open: talking to WAHA,
// and the cron that checks every user's birthdays at their chosen time.
// It uses the Supabase service_role key, which bypasses RLS, since the cron
// has to read across all users at once.

// supabase-js never throws on a failed write - it returns { error }. We log
// it explicitly so a history row silently failing to save (RLS, schema, etc.)
// is visible instead of an "OK" send with an empty history.
async function logMessage(row) {
  const { error } = await supabaseAdmin.from('messages_sent').insert(row);
  if (error) {
    console.error(`[history] could not save ${row.status} row for ${row.name}: ${error.message}`);
  }
}

// Replaces {prénom}/{name} tokens with the contact's name (mirror of the
// app's src/messageVars.js used for the preview).
function personalize(message, name) {
  const full = (name || '').trim();
  const first = full.split(/\s+/)[0] || '';
  return String(message || '')
    .replace(/\{(prénom|prenom|firstname|first_name)\}/gi, first)
    .replace(/\{(name|nom)\}/gi, full);
}

async function sendAndLog(userId, { id, name, phone_number: phoneNumber, message: rawMessage, media_url: mediaUrl, media_type: mediaType }) {
  const message = personalize(rawMessage, name);
  try {
    if (mediaUrl && mediaType === 'gif') {
      await sendWhatsAppGif(userId, phoneNumber, mediaUrl, message);
    } else if (mediaUrl) {
      await sendWhatsAppImage(userId, phoneNumber, mediaUrl, message);
    } else {
      await sendWhatsAppMessage(userId, phoneNumber, message);
    }
    await logMessage({
      user_id: userId,
      birthday_id: id,
      name,
      phone_number: phoneNumber,
      message,
      status: 'sent',
    });
    notifyUser(userId, 'Message envoyé 🎉', `Le message d'anniversaire pour ${name} est parti.`);
    console.log(`[send] OK -> ${name} (${phoneNumber})`);
    return { ok: true };
  } catch (err) {
    const errorMessage = err.response?.data?.message || err.message;
    console.error(`[send] FAILED -> ${name} (${phoneNumber}): ${errorMessage}`);
    await logMessage({
      user_id: userId,
      birthday_id: id,
      name,
      phone_number: phoneNumber,
      message,
      status: 'failed',
      error: errorMessage,
    });
    notifyUser(userId, "Échec de l'envoi", `Le message pour ${name} n'a pas pu être envoyé.`);
    return { ok: false, error: errorMessage };
  }
}

async function checkTodaysBirthdaysForUser(userId) {
  // Use this user's own timezone so "today" matches what they see in the app.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('timezone')
    .eq('id', userId)
    .single();
  const { month, day } = localNow(profile?.timezone || DEFAULT_TIMEZONE);

  const { data: rows, error } = await supabaseAdmin
    .from('birthdays')
    .select('*')
    .eq('user_id', userId)
    .eq('month', month)
    .eq('day', day);
  if (error) throw error;

  console.log(`[scheduler] user ${userId}: ${rows.length} birthday(s) matched today (${month}/${day})`);
  return Promise.all(rows.map((row) => sendAndLog(userId, row)));
}

// ---------- send-time scheduling (each birthday has its own send time) ----------

// Fly.io machines run in UTC. Send times are entered by each user in their own
// local time, so the scheduler compares everything in that user's timezone
// (stored on profiles.timezone). Falls back to Europe/Paris for old rows.
const DEFAULT_TIMEZONE = 'Europe/Paris';

// The current date + time as seen in a given IANA timezone:
// { dateStr: 'YYYY-MM-DD', month, day, hm: 'HH:MM' }. Handles DST for free.
function localNow(timeZone = DEFAULT_TIMEZONE) {
  let tz = timeZone;
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
  } catch (e) {
    // Unknown/invalid tz string -> fall back so a bad value can't crash the tick.
    tz = DEFAULT_TIMEZONE;
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date());
  }
  const get = (type) => parts.find((p) => p.type === type).value;
  return {
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    month: Number(get('month')),
    day: Number(get('day')),
    hm: `${get('hour')}:${get('minute')}`,
  };
}

// userId -> IANA timezone, from profiles (paginated). Users without a value
// fall back to DEFAULT_TIMEZONE via localNow().
async function fetchTimezones() {
  const PAGE = 1000;
  const map = new Map();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, timezone')
      .range(from, from + PAGE - 1);
    if (error) {
      // Before the 0008 migration runs, profiles.timezone doesn't exist yet.
      // Degrade gracefully to "everyone on the default timezone" (the previous
      // behaviour) instead of failing the whole tick and skipping all sends.
      console.warn('[scheduler] timezone lookup failed, using default for all:', error.message);
      return new Map();
    }
    for (const row of data) map.set(row.id, row.timezone || DEFAULT_TIMEZONE);
    if (data.length < PAGE) break;
  }
  return map;
}

// PostgREST caps a single response at 1000 rows by default, so on a popular
// birthday date the scheduler could silently miss everyone past the first
// 1000. Page through with .range() until a short page signals the end.
async function fetchBirthdaysForDay(month, day) {
  const PAGE = 1000;
  let all = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('birthdays')
      .select('*')
      .eq('month', month)
      .eq('day', day)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all = all.concat(data);
    if (data.length < PAGE) break;
  }
  return all;
}

// Small randomized pause - used to space out WhatsApp sends within a batch so
// the traffic looks less bot-like (helps avoid rate-limits/bans).
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Every few minutes: find every birthday due right now and send it. "Now" and
// "today" are evaluated in each user's own timezone (profiles.timezone), so a
// send_time of 09:00 fires at 09:00 local wherever the user is. Different
// timezones can even be on different calendar days near midnight - we query the
// union of "today" dates across all timezones in play, then filter per user.
async function runScheduleTick() {
  let tzByUser;
  try {
    tzByUser = await fetchTimezones();
  } catch (err) {
    console.error('[scheduler] could not load timezones:', err.message);
    return;
  }

  // Precompute localNow() once per distinct timezone (there are only a handful
  // even with many users), then the set of (month,day) dates to query.
  const distinctTzs = new Set([...tzByUser.values(), DEFAULT_TIMEZONE]);
  const nowByTz = new Map();
  for (const tz of distinctTzs) nowByTz.set(tz, localNow(tz));
  const dateKeys = new Set([...nowByTz.values()].map((n) => `${n.month}-${n.day}`));

  // Fetch birthdays for each candidate date, de-duplicated by id.
  const byId = new Map();
  try {
    for (const key of dateKeys) {
      const [m, d] = key.split('-').map(Number);
      for (const row of await fetchBirthdaysForDay(m, d)) byId.set(row.id, row);
    }
  } catch (err) {
    console.error('[scheduler] could not load birthdays:', err.message);
    return;
  }

  // Keep only rows whose own user-local today matches and whose send_time has
  // passed and that haven't already gone out today (in that user's date).
  const due = [];
  for (const row of byId.values()) {
    const tz = tzByUser.get(row.user_id) || DEFAULT_TIMEZONE;
    const n = nowByTz.get(tz) || localNow(tz);
    if (
      row.month === n.month &&
      row.day === n.day &&
      row.last_sent_date !== n.dateStr &&
      n.hm >= (row.send_time || '09:00')
    ) {
      due.push({ row, dateStr: n.dateStr });
    }
  }

  console.log(`[scheduler] tick: ${byId.size} birthday(s) across ${dateKeys.size} date(s), ${due.length} due`);

  for (let i = 0; i < due.length; i++) {
    const { row, dateStr } = due[i];
    try {
      const result = await sendAndLog(row.user_id, row);
      // Only mark as sent for the day when it actually went through, so a
      // transient WhatsApp/WAHA hiccup is retried on the next tick instead of
      // silently skipping today's message. Uses the user's local date.
      if (result.ok) {
        await supabaseAdmin.from('birthdays').update({ last_sent_date: dateStr }).eq('id', row.id);
      }
    } catch (err) {
      console.error(`[scheduler] birthday ${row.id} failed:`, err.message);
    }
    // Space out consecutive sends with a randomized 0.4-1.5s pause so a batch
    // doesn't fire as one bot-like burst. Skip after the last one.
    if (i < due.length - 1) {
      await sleep(400 + Math.floor(Math.random() * 1100));
    }
  }
}

// ---------- routes ----------

// Simple in-memory per-key sliding-window rate limiter. Good enough for a
// single machine; if the backend ever scales horizontally, move this to
// Redis/Postgres so the window is shared.
const rateBuckets = new Map();
function rateLimit(key, max, windowMs) {
  const now = Date.now();
  const hits = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    rateBuckets.set(key, hits);
    return false;
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  return true;
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// AI birthday-message generator (Groq - free, fast). Set GROQ_API_KEY as a Fly
// secret. Returns { message }.
app.post('/api/generate-message', requireAuth, async (req, res) => {
  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(503).json({ error: 'AI not configured' });
  // Cap AI generations per user (10/min) so a single account can't burn the
  // shared Groq quota.
  if (!rateLimit(`ai:${req.userId}`, 10, 60000)) {
    return res.status(429).json({ error: 'Trop de générations, réessaie dans un instant.' });
  }
  const { name, tone, lang, prompt } = req.body || {};
  const language = { fr: 'français', de: 'allemand', en: 'anglais' }[lang] || 'français';
  const styles = {
    fun: 'drôle et décalé',
    warm: 'chaleureux et sincère',
    short: 'très court',
    classic: 'classique et élégant',
  };
  const style = styles[tone] || 'chaleureux';
  // Optional free-text instruction typed by the user (e.g. "mentionne le foot").
  // Trimmed and capped so it can't blow up the prompt.
  const extra = typeof prompt === 'string' ? prompt.trim().slice(0, 300) : '';
  try {
    const { data } = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: `Tu écris des messages d'anniversaire courts (1 à 2 phrases) en ${language}, avec 1 ou 2 emojis. Réponds UNIQUEMENT avec le message, sans guillemets ni introduction.`,
          },
          {
            role: 'user',
            content:
              `Écris un message d'anniversaire ${style}${name ? ' pour ' + name : ''}.` +
              (extra ? ` Consignes à respecter : ${extra}` : ''),
          },
        ],
        temperature: 1.05,
        max_tokens: 140,
      },
      { headers: { Authorization: `Bearer ${key}` }, timeout: 20000 },
    );
    const message = data.choices?.[0]?.message?.content?.trim();
    if (!message) throw new Error('empty response');
    res.json({ message });
  } catch (err) {
    console.error('[ai] generate failed:', err.response?.data?.error?.message || err.message);
    res.status(502).json({ error: 'AI generation failed' });
  }
});

// ---------- RevenueCat subscription webhook ----------
//
// RevenueCat calls this on every subscription lifecycle event. We set the RC
// "app_user_id" to the Supabase user id (Purchases.logIn(userId) in the app),
// so we can flip profiles.is_pro on the right account. is_pro stays the single
// source of truth the app + the free-plan DB trigger read.
//
// Auth: set REVENUECAT_WEBHOOK_TOKEN as a Fly secret AND paste the same value
// in RevenueCat > Project > Webhooks > Authorization header.

// Event types that mean the user currently has (or regains) Pro access.
const PRO_ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
]);
// Types that end access. (CANCELLATION only turns off auto-renew - access
// stays until EXPIRATION, so we don't downgrade on CANCELLATION.)
const PRO_ENDED_EVENTS = new Set(['EXPIRATION']);

async function setProStatus(userId, isPro, { product, expiresAtMs } = {}) {
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      is_pro: isPro,
      pro_product: product ?? null,
      pro_expires_at: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
      pro_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) console.error(`[pro] could not update ${userId}: ${error.message}`);
  else console.log(`[pro] ${userId} -> is_pro=${isPro} (product=${product || '-'})`);
}

app.post('/api/revenuecat/webhook', async (req, res) => {
  const expected = process.env.REVENUECAT_WEBHOOK_TOKEN;
  if (expected && req.headers.authorization !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!expected) console.warn('[pro] REVENUECAT_WEBHOOK_TOKEN not set - webhook is unauthenticated');

  const event = req.body?.event;
  if (!event) return res.status(400).json({ error: 'missing event' });

  const userId = event.app_user_id;
  if (!userId) return res.json({ ok: true, skipped: 'no app_user_id' });

  try {
    if (PRO_ACTIVE_EVENTS.has(event.type)) {
      await setProStatus(userId, true, {
        product: event.product_id,
        expiresAtMs: event.expiration_at_ms,
      });
    } else if (PRO_ENDED_EVENTS.has(event.type)) {
      await setProStatus(userId, false);
    } else {
      console.log(`[pro] ignoring event type ${event.type} for ${userId}`);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[pro] webhook error:', err.message);
    res.status(500).json({ error: 'internal error' });
  }
});

// Manual "Test" button - sends that birthday's stored message right now.
// Looked up by id AND owning user, so nobody can trigger a send for a
// birthday that isn't theirs by guessing ids.
app.post('/api/birthdays/:id/send', requireAuth, async (req, res) => {
  const { data: row, error } = await supabaseAdmin
    .from('birthdays')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.userId)
    .single();
  if (error || !row) return res.status(404).json({ error: 'birthday not found' });

  const result = await sendAndLog(req.userId, row);
  if (!result.ok) return res.status(502).json({ error: result.error });
  res.json({ ok: true });
});

// Ad-hoc send, not tied to a stored birthday.
app.post('/api/test-send', requireAuth, async (req, res) => {
  const { phoneNumber, message } = req.body;
  if (!phoneNumber || !message) {
    return res.status(400).json({ error: 'phoneNumber and message are required' });
  }

  try {
    await sendWhatsAppMessage(req.userId, phoneNumber, message);
    res.json({ ok: true });
  } catch (err) {
    res.status(502).json({ error: err.response?.data?.message || err.message });
  }
});

// Runs the exact same logic as the scheduled check, on demand, for the
// signed-in user only - lets you verify the date-matching flow without
// waiting for the scheduled time.
app.post('/api/birthdays/check-today', requireAuth, async (req, res) => {
  const results = await checkTodaysBirthdaysForUser(req.userId);
  res.json({ checked: results.length, results });
});

// Permanently delete the signed-in user's account + all their data. Deleting
// the auth user cascades to profiles/birthdays/messages_sent/settings (FKs
// are ON DELETE CASCADE). Also removes their WhatsApp session (best-effort).
app.post('/api/account/delete', requireAuth, async (req, res) => {
  try {
    try {
      await deleteSession(req.userId);
    } catch (e) {
      /* session may not exist - ignore */
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.userId);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[account] delete failed:', err.message);
    res.status(500).json({ error: 'delete failed' });
  }
});

// Every user gets their own WAHA session (their own linked WhatsApp),
// named after their Supabase user id - see waha.js#sessionNameFor.

app.get('/api/waha-status', requireAuth, async (req, res) => {
  try {
    const status = await getSessionStatus(req.userId);
    res.json(status);
  } catch (err) {
    if (err.response?.status === 404) return res.json({ status: 'NOT_CREATED' });
    res.status(502).json({ error: 'WAHA unreachable', details: err.message });
  }
});

// Creates+starts the session if it doesn't exist yet. Safe to call
// repeatedly.
app.post('/api/waha/start-session', requireAuth, async (req, res) => {
  try {
    const result = await startSession(req.userId);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'Could not start WAHA session', details: err.response?.data || err.message });
  }
});

// A session that timed out waiting for a QR scan lands in FAILED - restart
// it to get a fresh QR cycle instead of creating a whole new session.
app.post('/api/waha/restart-session', requireAuth, async (req, res) => {
  try {
    const result = await restartSession(req.userId);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'Could not restart WAHA session', details: err.response?.data || err.message });
  }
});

// Pairing-code alternative to the QR - lets the user link the WhatsApp on the
// same phone the app runs on. Session must be started first (the app calls
// /waha/start-session before this).
app.post('/api/waha/request-code', requireAuth, async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: 'phoneNumber is required' });
  try {
    const result = await requestPairingCode(req.userId, phoneNumber);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: 'Could not request pairing code', details: err.response?.data || err.message });
  }
});

app.get('/api/waha/qr', requireAuth, async (req, res) => {
  try {
    const png = await getQrCode(req.userId);
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'no-store');
    res.send(Buffer.from(png));
  } catch (err) {
    res.status(502).json({ error: 'Could not fetch QR code', details: err.message });
  }
});

// ---------- cron ----------

// Once a minute: a birthday's message goes out within ~60s of its send_time.
// runScheduleTick is idempotent per day (birthdays.last_sent_date guard), so
// running it often is safe. Keep the backend to a single machine so only one
// scheduler runs (see `fly scale count 1`).
cron.schedule('* * * * *', () => {
  runScheduleTick().catch((err) => console.error('[scheduler] failed:', err));
});

app.listen(PORT, () => {
  console.log(`WhosDay Backend running on http://localhost:${PORT}`);
  console.log(`Make sure WAHA is running (${process.env.WAHA_URL || 'http://localhost:3000'})`);
  runScheduleTick().catch((err) => console.error('[scheduler] failed:', err));
});
