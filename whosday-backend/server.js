require('dotenv').config();

const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const supabaseAdmin = require('./supabaseAdmin');
const requireAuth = require('./requireAuth');
const { notifyUser } = require('./pushNotifications');
const {
  sendWhatsAppMessage,
  getSessionStatus,
  startSession,
  restartSession,
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

async function sendAndLog(userId, { id, name, phone_number: phoneNumber, message }) {
  try {
    await sendWhatsAppMessage(userId, phoneNumber, message);
    await supabaseAdmin.from('messages_sent').insert({
      user_id: userId,
      birthday_id: id,
      name,
      phone_number: phoneNumber,
      message,
      status: 'sent',
    });
    notifyUser(userId, 'Message envoyé 🎉', `Le message d'anniversaire pour ${name} est parti.`);
    return { ok: true };
  } catch (err) {
    const errorMessage = err.response?.data?.message || err.message;
    await supabaseAdmin.from('messages_sent').insert({
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
  const today = new Date();
  const month = today.getMonth() + 1;
  const day = today.getDate();

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

// ---------- send-time scheduling (fixed hour, or a fresh random hour each day) ----------

function pad2(n) {
  return String(n).padStart(2, '0');
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function nowHM() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function randomTimeInWindow(start, end) {
  const toMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const startMin = toMinutes(start);
  const endMin = toMinutes(end);
  const pick = startMin + Math.floor(Math.random() * (endMin - startMin + 1));
  return `${pad2(Math.floor(pick / 60))}:${pad2(pick % 60)}`;
}

async function saveSettingsForUser(userId, patch) {
  const { data, error } = await supabaseAdmin
    .from('settings')
    .update(patch)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Runs once per user, per tick. Picks (and remembers) today's target send
// time, then fires that user's birthday check once that time has passed -
// at most once a day per user.
async function tickForUser(settings, current) {
  let s = settings;

  if (s.today_date !== current) {
    const targetTime =
      s.send_mode === 'random'
        ? randomTimeInWindow(s.random_window_start, s.random_window_end)
        : s.fixed_time;
    s = await saveSettingsForUser(s.user_id, { today_date: current, today_target_time: targetTime });
  }

  if (s.last_sent_date === current) return;
  if (nowHM() < s.today_target_time) return;

  await checkTodaysBirthdaysForUser(s.user_id);
  await saveSettingsForUser(s.user_id, { last_sent_date: current });
}

async function runScheduleTick() {
  const { data: allSettings, error } = await supabaseAdmin.from('settings').select('*');
  if (error) {
    console.error('[scheduler] could not load settings:', error.message);
    return;
  }

  const current = todayStr();
  for (const settings of allSettings) {
    try {
      await tickForUser(settings, current);
    } catch (err) {
      console.error(`[scheduler] user ${settings.user_id} failed:`, err.message);
    }
  }
}

// ---------- routes ----------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
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

// 5-minute resolution is plenty for a "send once a day, at roughly this
// time" schedule - see tickForUser for how the target time is picked.
cron.schedule('*/5 * * * *', () => {
  runScheduleTick().catch((err) => console.error('[scheduler] failed:', err));
});

app.listen(PORT, () => {
  console.log(`WhosDay Backend running on http://localhost:${PORT}`);
  console.log(`Make sure WAHA is running (${process.env.WAHA_URL || 'http://localhost:3000'})`);
  runScheduleTick().catch((err) => console.error('[scheduler] failed:', err));
});
