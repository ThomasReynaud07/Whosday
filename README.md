# WhosDay - Birthday Reminder with WhatsApp Automation

Prototype pour tester l'envoi automatique de messages WhatsApp le jour de l'anniversaire de tes contacts.

## Project Structure

```
Whosday/
├── whosday-backend/          # Node.js Express API
│   ├── server.js              # Routes + cron job
│   ├── db.js                  # SQLite (node:sqlite) schema/setup
│   ├── waha.js                 # WAHA (WhatsApp) client
│   ├── package.json
│   └── Dockerfile
│
├── whosday-frontend/         # React Native (Expo) app
│   ├── App.js                  # Main mobile UI
│   ├── app.json
│   └── package.json
│
├── docker-compose.yml         # WAHA + Backend orchestration
└── SETUP_GUIDE.md             # Step-by-step setup instructions
```

## Quick Start

### Prerequisites
- Node.js 22.5+ (needed for the built-in `node:sqlite` module)
- Docker Desktop (recommended - avoids installing WAHA manually)
- iPhone with the Expo Go app, or an emulator

### Option 1: Docker for WAHA + Backend (recommended)

```powershell
# Terminal 1: WAHA + Backend
docker-compose up

# Terminal 2: Frontend
cd whosday-frontend
npm install
npm start
```

### Option 2: Fully manual

```powershell
# Terminal 1: WAHA
docker run -p 3000:3000 devlikeapro/waha:latest

# Terminal 2: Backend
cd whosday-backend
npm install
copy .env.example .env
npm run dev

# Terminal 3: Frontend
cd whosday-frontend
npm install
npm start
```

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for the full walkthrough.

## Features (MVP)

- Add birthdays - name, phone, date, custom message
- SQLite storage (zero-setup, ships with Node.js)
- Manual "Test" send button
- Auto-send daily via cron (9:00 AM by default, configurable)
- Message history log
- Delete birthdays

## API Endpoints

```
GET    /api/health                    // Health check
GET    /api/birthdays                 // List all birthdays
POST   /api/birthdays                 // Add a birthday
DELETE /api/birthdays/:id             // Delete a birthday
POST   /api/birthdays/:id/send        // Send that birthday's message now ("Test" button)
POST   /api/birthdays/check-today     // Run the same check the daily cron runs, on demand
POST   /api/test-send                 // Ad-hoc send: { phoneNumber, message }
GET    /api/messages-sent             // Message history
GET    /api/waha-status               // WAHA session status (linked / not linked)
POST   /api/waha/start-session        // Create/start the WhatsApp session
GET    /api/waha/qr                   // QR code (PNG) to scan and link WhatsApp
```

## Tech Stack

**Backend:** Express, `node:sqlite` (built into Node.js, no native compile step), WAHA (WhatsApp automation), node-cron.

**Frontend:** React Native (Expo), Axios.

**Infra:** Docker Compose for WAHA + backend. SQLite file on disk (or a named Docker volume).

## Important Notes

- WAHA needs to stay running and linked to WhatsApp (QR scan) for sends to work.
- The default free `devlikeapro/waha` Docker image is used (not `waha-plus`, which needs a paid license).
- Port 3000 is WAHA's default port - something else may already be using it on your machine, check before starting (see SETUP_GUIDE troubleshooting).
- This automates *your own* WhatsApp Web session for personal reminders to your own contacts - it's not the WhatsApp Business API. Don't use it for bulk/unsolicited messaging.

## Next Steps

- [ ] Calendar sync (auto-import from Apple Calendar / `expo-calendar`)
- [ ] SMS fallback if WhatsApp fails
- [ ] Cloud deploy (Railway/Fly.io) + swap SQLite for Postgres
- [ ] User auth for multi-user support
- [ ] Push notifications instead of relying on the cron alone

For detailed instructions, see `SETUP_GUIDE.md`.
