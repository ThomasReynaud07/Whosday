const axios = require('axios');
const sharp = require('sharp');

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

// Sends an image (by public URL) with an optional caption. Used when a
// birthday has an attached message image (birthdays.media_url).
async function sendWhatsAppImage(userId, phoneNumber, imageUrl, caption) {
  // Download the image and send it as raw base64 bytes (WhatsApp CDN upload by
  // URL is unreliable on the browserless engines). Re-encode to a clean,
  // resized JPEG with sharp so the format is always WhatsApp-compatible
  // (guards against odd formats) and lighter (bandwidth/cost).
  const img = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 20000 });
  let buffer = Buffer.from(img.data);
  let mimetype = img.headers["content-type"] || "image/jpeg";
  try {
    buffer = await sharp(buffer)
      .rotate() // honour EXIF orientation
      .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    mimetype = "image/jpeg";
  } catch (e) {
    console.error(`[send] sharp re-encode failed, sending original: ${e.message}`);
  }
  const data = buffer.toString("base64");
  const response = await axios.post(
    `${WAHA_URL}/api/sendImage`,
    {
      session: sessionNameFor(userId),
      chatId: toChatId(phoneNumber),
      file: { mimetype, filename: "whosday.jpg", data },
      caption,
    },
    { timeout: 60000, headers: authHeaders }
  );
  return response.data;
}

// Sends an animated GIF as a looping WhatsApp "GIF". We send the actual .gif
// bytes with convert=true: WAHA converts it to the gif-playback MP4 format
// WhatsApp expects (badge "GIF", auto-loop, no sound) - sending a plain MP4
// arrives as a normal video instead.
async function sendWhatsAppGif(userId, phoneNumber, gifUrl, caption) {
  const gif = await axios.get(gifUrl, { responseType: "arraybuffer", timeout: 20000 });
  const data = Buffer.from(gif.data).toString("base64");
  const response = await axios.post(
    `${WAHA_URL}/api/sendVideo`,
    {
      session: sessionNameFor(userId),
      chatId: toChatId(phoneNumber),
      file: { mimetype: "image/gif", filename: "whosday.gif", data },
      caption,
      convert: true,
      asNote: false,
    },
    { timeout: 90000, headers: authHeaders }
  );
  return response.data;
}

async function deleteSession(userId) {
  await axios.delete(`${WAHA_URL}/api/sessions/${sessionNameFor(userId)}`, {
    timeout: 10000,
    headers: authHeaders,
  });
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
    {
      name: sessionNameFor(userId),
      start: true,
      // markOnline:false keeps the user's phone as the "active" device, so
      // WhatsApp keeps delivering notifications there instead of treating
      // this linked session as the active client (see waha-fly WAHA_PRESENCE_AUTO_ONLINE).
      config: { noweb: { markOnline: false } },
    },
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

// Pairing-code auth: instead of scanning a QR (impossible when WhatsApp is on
// the same phone as the app), the user enters their number, gets an 8-char
// code, and types it into WhatsApp > Linked devices > "Link with phone number".
// The session must already be started before requesting a code.
async function requestPairingCode(userId, phoneNumber) {
  const digitsOnly = String(phoneNumber).replace(/\D/g, '');
  const response = await axios.post(
    `${WAHA_URL}/api/${sessionNameFor(userId)}/auth/request-code`,
    { phoneNumber: digitsOnly },
    { timeout: 15000, headers: authHeaders }
  );
  return response.data; // { code: "ABCD-ABCD" }
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
  sendWhatsAppImage,
  sendWhatsAppGif,
  deleteSession,
  getSessionStatus,
  startSession,
  restartSession,
  requestPairingCode,
  getQrCode,
  sessionNameFor,
  toChatId,
};
