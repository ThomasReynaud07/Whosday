# Deploying WhosDay to Fly.io

Two separate Fly apps: **whosday-waha** (internal only, not public) and
**whosday-backend** (public, the app talks to this). Run this once you have
a Fly.io account and have run `flyctl auth login`.

None of the commands below have real secrets pasted in - grab each value
from the `.env` file mentioned so nothing sensitive ends up committed to
this file.

## 1. Deploy WAHA

```powershell
cd waha-fly
flyctl apps create whosday-waha
flyctl volumes create waha_sessions --app whosday-waha --region cdg --size 1

# Values below are in the root .env file (created when WAHA first ran locally)
flyctl secrets set --app whosday-waha `
  WAHA_API_KEY=<from .env: WAHA_API_KEY> `
  WAHA_DASHBOARD_USERNAME=admin `
  WAHA_DASHBOARD_PASSWORD=<from .env: WAHA_DASHBOARD_PASSWORD> `
  WHATSAPP_SWAGGER_USERNAME=admin `
  WHATSAPP_SWAGGER_PASSWORD=<from .env: WHATSAPP_SWAGGER_PASSWORD>

flyctl deploy --app whosday-waha
```

## 2. Deploy the backend

```powershell
cd ../whosday-backend
flyctl apps create whosday-backend

# WAHA_API_KEY is the same value as above.
# SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are in whosday-backend/.env
flyctl secrets set --app whosday-backend `
  WAHA_API_KEY=<from .env: WAHA_API_KEY> `
  SUPABASE_URL=<from whosday-backend/.env: SUPABASE_URL> `
  SUPABASE_SERVICE_ROLE_KEY=<from whosday-backend/.env: SUPABASE_SERVICE_ROLE_KEY>

flyctl deploy --app whosday-backend
```

Both apps must be in the same Fly organization for `whosday-waha.internal`
private networking (used in `whosday-backend/fly.toml`) to resolve - that's
automatic if you deploy both under the same account without specifying
`--org`.

## 3. Point the app at the deployed backend

In [whosday-frontend/src/api.js](whosday-frontend/src/api.js), replace:
```js
export const BACKEND_URL = "http://192.168.1.26:5000/api";
```
with:
```js
export const BACKEND_URL = "https://whosday-backend.fly.dev/api";
```

Same in [whosday-frontend/src/screens/LinkWhatsAppScreen.js](whosday-frontend/src/screens/LinkWhatsAppScreen.js)
and [whosday-frontend/src/screens/ProfileScreen.js](whosday-frontend/src/screens/ProfileScreen.js)
if they end up with their own copy of the URL - they currently import it
from `api.js`, so the one change above should cover all three.

From this point on, the phone no longer needs to be on the same Wi-Fi as
your PC, and the backend keeps running (and the cron keeps firing) even
when your computer is off.

## Checking on things later

```powershell
flyctl logs --app whosday-backend
flyctl logs --app whosday-waha
flyctl status --app whosday-backend
```

## Cost note

Both apps use `shared-cpu-1x` machines (Fly's smallest paid tier once past
the free allowance). WAHA's `min_machines_running` isn't pinned to 1, so it
may scale to zero when idle - first request after idle will be slower
(cold start). The backend sets `min_machines_running = 1` so the cron
keeps firing on schedule instead of only waking up on a request.
