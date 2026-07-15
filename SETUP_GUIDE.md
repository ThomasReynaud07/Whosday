# WhosDay Prototype - Setup Instructions

**Objectif:** Tester l'envoi automatique de messages WhatsApp pour les anniversaires depuis ton iPhone.

---

## Quick Start (15 minutes)

### Step 1: Install WAHA (WhatsApp Automation)

```powershell
docker run -p 3000:3000 devlikeapro/waha:latest
```

> Note: the original notes referenced `waha-plus`, which is WAHA's paid tier and needs a license key.
> `devlikeapro/waha` is the free/open-source image - use that unless you already have a Plus license.

**Important - WAHA now requires auth by default.** On first start, it auto-generates an API key plus dashboard/swagger credentials and prints them to the container logs (`docker logs <container>` if you missed them), looking like:

```
WAHA_API_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WAHA_DASHBOARD_USERNAME=admin
WAHA_DASHBOARD_PASSWORD=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_SWAGGER_USERNAME=admin
WHATSAPP_SWAGGER_PASSWORD=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

If you just open http://localhost:3000 without these, every route answers `401 Unauthorized` - that's not a broken container, it's this.

**Save `WAHA_API_KEY`** into `whosday-backend/.env` (the backend needs it for every WAHA call) - see Step 2. To keep the same credentials across container restarts instead of getting new random ones each time, copy [.env.example](./.env.example) to `.env` at the repo root, fill in the values WAHA printed, and start WAHA via `docker-compose up` instead of a bare `docker run` (see docker-compose.yml, which now passes these through).

**Then create the session and scan the QR** (once the backend from Step 2 is running, this is the easiest path - no need to fight WAHA's own Basic-Auth-protected dashboard):

```powershell
curl -X POST http://localhost:5000/api/waha/start-session
```

Open **http://localhost:5000/api/waha/qr** directly in your browser - it shows the QR code image (the backend proxies it using your API key, so no auth prompt). **Scan it with WhatsApp on ton iPhone** (WhatsApp → Linked Devices → Link a Device) → ça link ton compte.

Check it worked:
```powershell
curl http://localhost:5000/api/waha-status
# status should move from "SCAN_QR_CODE" to "WORKING" within a few seconds of scanning
```

WAHA est maintenant relié à ton WhatsApp perso.

> Port 3000: this is what was answering with 401 during initial testing on this machine - it was WAHA itself (auth-protected), not a conflicting process. If you genuinely have something else bound to 3000, check with `netstat -ano | findstr :3000` and map WAHA to a different host port instead, e.g. `docker run -p 3001:3000 devlikeapro/waha:latest`, then update `WAHA_URL` in the backend `.env`.

---

### Step 2: Start Backend

```powershell
cd whosday-backend
npm install
copy .env.example .env
```

Edit `.env` and paste in the `WAHA_API_KEY` WAHA printed in Step 1 (the current `.env` in this repo already has the one generated during setup wired in - only needed if you regenerate it).

```powershell
npm run dev
```

**Output should show:**
```
WhosDay Backend running on http://localhost:5000
Make sure WAHA is running (http://localhost:3000)
Daily birthday check scheduled: "0 9 * * *"
```

You'll also see `ExperimentalWarning: SQLite is an experimental feature` - that's expected and harmless, it comes from Node's built-in `node:sqlite` module (used instead of `better-sqlite3` so nobody needs Visual Studio Build Tools installed just to run a prototype).

Backend est ready.

---

### Step 3: Start Frontend (App on iPhone)

```powershell
cd whosday-frontend
npm install
npm start
```

**Output:**
```
> Starting Metro Bundler
```

Ensuite dans le terminal:
- Press `i` pour iOS simulator (needs Xcode, Mac only), OU
- Scan le QR code avec **Expo Go** (App Store) sur ton iPhone réel (plus immersif)

Before scanning: open [App.js](./whosday-frontend/App.js) and update `API_URL` - see Step 3b below. `localhost` only works from a simulator running on the same machine; a real iPhone needs your PC's LAN IP.

**Step 3b - point the app at your backend:**

```powershell
ipconfig
# look for "IPv4 Address" under your active adapter (Wi-Fi usually), e.g. 192.168.1.50
```

In [App.js](./whosday-frontend/App.js), replace:
```js
const API_URL = 'http://localhost:5000/api';
```
with:
```js
const API_URL = 'http://192.168.1.50:5000/api';  // your PC's IPv4 address
```

Your iPhone and PC must be on the same Wi-Fi network. If Windows Firewall prompts when you first run `npm start`, allow access on Private networks.

App should open sur ton iPhone.

---

## Test Flow

### 1. Add a Birthday (in the app)

```
Name: Jane
Phone: +33612345678  (remplace par un vrai numéro pour test)
Month: 7
Day: 15
Message: Joyeux anniversaire Jane!
```

Click "Add Birthday" → Birthday appears in list.

### 2. Manual Test Send

Click "Test" button next to Jane's birthday.

**Expected:**
- Jane reçoit le message sur WhatsApp
- Alert appears: "Sent - Message sent to Jane!"

### 3. Test Cron Job (Auto-send) without waiting for 9 AM

The cron job matches birthdays against *today's* date, so the generic test-send below only proves WAHA can deliver a message - it doesn't exercise the date-matching logic. To actually test that logic on demand:

```powershell
curl -X POST http://localhost:5000/api/birthdays/check-today
```

This runs the exact function the 9 AM cron runs: find every birthday whose month/day equals today, send each one, and log the result. Add a birthday with today's month/day to see it fire.

For an arbitrary one-off message not tied to a stored birthday:
```powershell
curl -X POST http://localhost:5000/api/test-send `
  -H "Content-Type: application/json" `
  -d '{\"phoneNumber\": \"+33612345678\", \"message\": \"Test message from WhosDay!\"}'
```

---

## Architecture Diagram

```
iPhone (Expo Go / Expo app)
    │
    ├── http://<your-PC-IP>:5000/api
    │   (Backend: Express + node:sqlite + node-cron)
    │
    └── WAHA (port 3000)
        ├── [Linked to your WhatsApp via QR]
        └── Sends messages via WhatsApp Web protocol
```

---

## Common Issues

### "Cannot reach localhost" / Network request failed on iPhone

**Problem:** the app can't connect to backend - almost always because `localhost` on a physical phone means the phone itself, not your PC.

**Solution:** see Step 3b above (`ipconfig`, LAN IP, same Wi-Fi network, firewall prompt).

### WAHA not connecting to WhatsApp

1. `curl -X POST http://localhost:5000/api/waha/start-session` (safe to re-run - a no-op if a session already exists)
2. Open http://localhost:5000/api/waha/qr in the browser for a fresh QR
3. In WhatsApp on the phone: Linked Devices → Link a Device → scan
4. Check `GET http://localhost:5000/api/waha-status` shows `"status":"WORKING"`

### 401 Unauthorized on anything at localhost:3000

WAHA's auth is on and the backend's `WAHA_API_KEY` doesn't match what WAHA is running with (or wasn't set at all). Get the current key from `docker logs <waha-container>`, put it in `whosday-backend/.env` as `WAHA_API_KEY`, and restart the backend. If you're on `docker-compose`, set it in the root `.env` instead (see [.env.example](./.env.example)) so both services agree on it.

### Messages not sending

1. Check phone number format: `+33612345678` (with country code) - the backend strips non-digits and appends `@c.us` for you
2. Make sure WAHA is running and linked (`http://localhost:3000`, session status `WORKING`)
3. Check the backend terminal logs, and `GET /api/messages-sent` for the recorded error

### `npm install` fails in whosday-backend with node-gyp / Visual Studio errors

You're likely on an old copy of this repo that still used `better-sqlite3`. The current `db.js` uses Node's built-in `node:sqlite` instead, which needs no compiler at all - just make sure `node --version` is 22.5 or newer.

### App crashes / Metro won't start

```powershell
cd whosday-frontend
Remove-Item -Recurse -Force node_modules
npm install
npx expo install --fix   # aligns dependency versions with your installed Expo SDK
npm start
```

---

## What We're Testing

**Core Flow:**
1. Add birthday contact with phone + date
2. Manual test-send button works
3. WhatsApp messages arrive

**Cron Job (Auto-send):**
- Every day at 9:00 AM (`CRON_SCHEDULE` in `.env`)
- Checks if any birthdays match today
- Auto-sends messages, logs each attempt

**Database:**
- Birthdays stored in SQLite (`whosday.db` in `whosday-backend/`, gitignored)
- Message history logged (success and failure, with error detail)
- Can delete birthdays

---

## Next Steps (After Testing)

Once core works, we can add:
- [ ] Calendar sync (auto-import from Apple Calendar)
- [ ] Better UI (design with Figma)
- [ ] SMS fallback (if WhatsApp fails)
- [ ] Cloud deploy (Railway/Fly.io)
- [ ] User auth (save data to cloud)

---

## Debug Mode

**Terminal 1:** WAHA
```powershell
docker run -p 3000:3000 devlikeapro/waha:latest
```

**Terminal 2:** Backend
```powershell
cd whosday-backend
npm run dev
```

**Terminal 3:** Frontend
```powershell
cd whosday-frontend
npm start
```

Open 3 terminals side-by-side. Check logs in each if something breaks.

---

## Test Numbers (for learning)

If you need to test without real contacts:
- Your own number (send yourself)
- A test contact from WhatsApp

---

**Ready? Let's test!**
