# [D.S.] Flyer Drop

> Password-protected event flyer system for **Duval Sound** — built for the underground.  
> Guests scan a QR code, enter a password, and unlock an animated flyer experience.

**Live site:** [dsflyerdrop.netlify.app](https://dsflyerdrop.netlify.app)

---

## What It Does

- 🔒 **Password-locked lock screen** with glitching DS logo background and VCR effects
- 🎨 **Dynamic color theming** — extracts palette from each flyer and recolors the entire UI
- 🏙️ **Jacksonville skyline** rendered as a PS2-style 3D wireframe mesh that orbits the city
- 🖼️ **Multi-flyer support** — scroll vertically through multiple event flyers, each with its own palette and message
- 👻 **Ghost flash effects** — DS logo and squid mascot appear as rare glitch artifacts
- 📊 **Stats tracking** — views, unlocks, fails, and unique visitors logged to Google Sheets
- 💬 **Admin message board** — post console-style messages below each flyer
- 🔐 **Server-side auth** — passwords never appear in source code

---

## File Structure

```
├── index.html                        # Main app — single self-contained file
├── flyer1.png                        # Active event flyer(s)
├── flyer2.png
├── netlify.toml                      # Netlify build + header config
├── robots.txt                        # Blocks search engine indexing
├── package.json                      # googleapis dependency
└── netlify/
    └── functions/
        ├── verify.js                 # Server-side password check
        ├── manage-passwords.js       # Add/remove passwords via Netlify API
        ├── log-event.js              # Logs events to Google Sheets (Eastern TZ only)
        ├── get-stats.js              # Reads aggregated stats from Google Sheets
        ├── get-message.js            # Reads per-flyer admin message
        └── set-message.js            # Saves per-flyer admin message
```

---

## Managing Flyers

Edit the `FLYERS` array near the top of `index.html`:

```js
const FLYERS = [
  "flyer1.png",
  "flyer2.png",
  "flyer3.png"
];
```

- **Add a flyer** — upload `flyer4.png` to GitHub, add `"flyer4.png"` to the array
- **Remove a flyer** — delete it from the array (and optionally from the repo)
- **Reorder** — change the order in the array; guests scroll top to bottom

Flyers display in order. Each gets its own color palette, console message, and scroll section.

---

## Passwords

All passwords are stored in **Netlify Environment Variables** — never in source code.

| Variable | Description |
|---|---|
| `USER_PASSWORDS` | Comma-separated guest passwords e.g. `duvalsound,vippass` |
| `ADMIN_PASSWORDS` | Comma-separated admin passwords e.g. `squidlysound,desty` |

To update: **Netlify → Site → Environment Variables → edit → Trigger deploy**

Passwords are case-insensitive. Multiple passwords of each type are supported.

---

## Admin Panel

Enter any admin password on the lock screen to access:

- **Live Stats** — views, unlocks, fails, unique visitors, 7-day chart, recent activity (pulled from Google Sheets)
- **Guest Message** — per-flyer message displayed as animated console text below each flyer. Select flyer from dropdown, type message, save.
- **Exit Admin** — returns to lock screen

---

## Environment Variables

Set all of these in **Netlify → Site → Environment Variables**:

| Variable | Required | Description |
|---|---|---|
| `USER_PASSWORDS` | ✅ | Guest passwords (comma-separated) |
| `ADMIN_PASSWORDS` | ✅ | Admin passwords (comma-separated) |
| `GOOGLE_SHEET_ID` | ✅ | ID from your Google Sheet URL |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | ✅ | Full JSON content of service account key file |
| `NETLIFY_SITE_ID` | Optional | Enables persistent password changes from admin panel |
| `NETLIFY_API_KEY` | Optional | Personal access token for Netlify API |

---

## Google Sheets Setup

The sheet tracks all visitor events and stores admin messages.

**Sheet tabs:**
| Tab | Contents |
|---|---|
| `Events` | One row per event: `type, timestamp, date, time ET, ip_hash, user_agent` |
| `Message1` | Console message for flyer 1 (auto-created on first save) |
| `Message2` | Console message for flyer 2 |
| `MessageN` | ... |

**To set up:**
1. Create a Google Sheet named `Duval Sound Stats`
2. Add a tab called `Events` with headers: `type | timestamp | date | time | ip_hash | user_agent`
3. Enable the **Google Sheets API** in Google Cloud Console
4. Create a **Service Account** → download the JSON key
5. Share the sheet with the service account's `client_email` as Editor
6. Add `GOOGLE_SHEET_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON` to Netlify env vars

**Timezone filtering:** Only visitors in Eastern Time (UTC-4 / UTC-5) are logged — filters out non-local traffic automatically.

---

## Deploying Changes

1. Make edits locally or via GitHub web UI
2. Push/commit to `main`
3. Netlify auto-deploys within ~30 seconds

**To update a flyer:**
1. Rename your new image to `flyer1.png` (or whichever slot)
2. Upload to GitHub replacing the old file
3. Netlify redeploys — no HTML changes needed

---

## Tech Stack

| Layer | Technology |
|---|---|
| Hosting | Netlify (static + functions) |
| Auth | Netlify Functions (server-side) |
| Database | Google Sheets via googleapis |
| Analytics | Google Analytics (G-9XVF3WYZ61) |
| Frontend | Vanilla HTML / CSS / Canvas API |
| Fonts | Bebas Neue, Space Mono, Orbitron (Google Fonts) |
| Version control | GitHub (private repo) |

---

## Analytics

Google Analytics tracks all events automatically. Custom events:
- `flyer_view` — page load
- `flyer_unlock` — correct password entered
- `flyer_fail` — wrong password attempt

View in: **GA → Reports → Engagement → Events**

---

*Duval Sound · Jacksonville, FL*
