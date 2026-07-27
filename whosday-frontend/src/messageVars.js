// Personalises a message template by replacing {prénom}/{name} tokens with the
// contact's name. Used for the live preview in the app; the backend does the
// same at send time (see whosday-backend/server.js).
export function personalizeMessage(message, name) {
  const full = (name || "").trim();
  const first = full.split(/\s+/)[0] || "";
  return String(message || "")
    .replace(/\{(prénom|prenom|firstname|first_name)\}/gi, first)
    .replace(/\{(name|nom|prénom_nom)\}/gi, full);
}
