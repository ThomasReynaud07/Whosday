const axios = require('axios');

const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3000';

// Recent WAHA images auto-generate an API key and reject unauthenticated
// /api/* calls. Only added when set, so this still works against a WAHA
// instance that has auth disabled.
const authHeaders = process.env.WAHA_API_KEY
  ? { 'X-Api-Key': process.env.WAHA_API_KEY }
  : {};

// Each WhosDay user gets their own WAHA session (their own linked
// WhatsApp), named after their Supabase user id. WAHA session names must be
// alphanumeric/underscore, hence the "u" prefix and stripped dashes.
function sessionNameFor(userId) {
  return `u${String(userId).replace(/-/g, '')}`;
}

// WAHA expects a chatId like "33612345678@c.us" - strip everything
// but digits from whatever phone format the user typed in.
function toChatId(phoneNumber) {
  const digitsOnly = String(phoneNumber).replace(/\D/g, '');
  return `${digitsOnly}@c.us`;
}

async function sendWhatsAppMessage(userId, phoneNumber, text) {
  const response = await axios.post(
    `${WAHA_URL}/api/sendText`,
    {
      session: sessionNameFor(userId),
      chatId: toChatId(phoneNumber),
      text,
    },
    { timeout: 15000, headers: authHeaders }
  );
  return response.data;
}

async function getSessionStatus(userId) {
  const response = await axios.get(`${WAHA_URL}/api/sessions/${sessionNameFor(userId)}`, {
    timeout: 5000,
    headers: authHeaders,
  });
  return response.data;
}

async function startSession(userId) {
  const response = await axios.post(
    `${WAHA_URL}/api/sessions`,
    { name: sessionNameFor(userId), start: true },
    { timeout: 10000, headers: authHeaders }
  );
  return response.data;
}

async function restartSession(userId) {
  const response = await axios.post(
    `${WAHA_URL}/api/sessions/${sessionNameFor(userId)}/restart`,
    {},
    { timeout: 10000, headers: authHeaders }
  );
  return response.data;
}

async function getQrCode(userId) {
  const response = await axios.get(`${WAHA_URL}/api/${sessionNameFor(userId)}/auth/qr`, {
    timeout: 10000,
    headers: authHeaders,
    responseType: 'arraybuffer',
  });
  return response.data;
}

module.exports = {
  sendWhatsAppMessage,
  getSessionStatus,
  startSession,
  restartSession,
  getQrCode,
  sessionNameFor,
  toChatId,
};
