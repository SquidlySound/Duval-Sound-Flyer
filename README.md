# [D.S.] Flyer Drop

> Password-protected event flyer system for **Duval Sound** — built for the underground.  
> Guests scan a QR code, enter a password, and unlock an animated flyer experience.

**Live site:** [dsflyerdrop.netlify.app](https://dsflyerdrop.netlify.app)

---

## What It Does

- 🔒 **Password-locked lock screen** with glitching DS logo background and VCR effects
- 🎨 **Dynamic color theming** — extracts palette from each flyer and recolors the entire UI
- 🏙️ **Jacksonville skyline** rendered as a PS2-style 3D wireframe mesh that orbits the city
- 🖼️ **Multi-media gallery** — vertical scroll through event flyers and videos, each with its own palette
- 👻 **Ghost flash effects** — DS logo and squid mascot appear as rare glitch artifacts
- 📊 **Stats tracking** — views, unlocks, fails, and unique visitors logged to Google Sheets (Eastern TZ only)
- 💬 **Per-admin message board** — each admin posts their own named console-style message per flyer
- 🔐 **Server-side auth** — passwords never appear in source code
- ⚙️ **Auto-updating gallery** — drop files into `/flyers/`, GitHub Action updates the manifest automatically

---

## File Structure

```
├── index.html                        # Main app — single self-contained file
├── flyers.json                       # Auto-generated manifest of active media
├── flyers/                           # Drop event flyers and videos here
│   ├── 01_show.png
│   ├── 02_promo.mp4
│   └── ...
├── netlify.toml                      # Netlify build + header config
├── robots.txt                        # Blocks search engine indexing
├── package.json                      # googleapis dependency
├── .github/
│   └── workflows/
│       └── update-flyers.yml         # Auto-updates flyers.json on push
└── netlify/
    └── functions/
        ├── verify.js                 # Server-side password check
        ├── manage-passwords.js       # Add/remove passwords via Netlify API
        ├── log-event.js              # Logs events to Google Sheets (Eastern TZ only)
        ├── get-stats.js              # Reads aggregated stats from Google Sheets
        ├── get-message.js            # Reads per-admin messages per flyer
        └── set-message.js            # Saves per-admin message per flyer
```

---

## Managing Flyers & Videos

**Just drop files into the `/flyers/` folder on GitHub.** The GitHub Action handles the rest.

Supported formats: `.png` `.jpg` `.jpeg` `.gif` `.webp` `.mp4` `.webm` `.mov`

**To control display order** — files are sorted alphabetically, so prefix with numbers:
```
01_may-show.png
02_promo.mp4
03_june-show.png
```

**To remove a flyer** — delete the file from `/flyers/`. The Action updates `flyers.json` automatically on the next push.

**Videos** play automatically, looped, muted, full width. Color theming and ghost effects apply to images only.

> `flyers.json` is auto-generated — do not edit it manually.

---

## Passwords

All passwords live in **Netlify Environment Variables** — never in source code.

| Variable | Description |
|---|---|
| `USER_PASSWORDS` | Comma-separated guest passwords e.g. `duvalsound,vippass` |
| `ADMIN_PASSWORDS` | Comma-separated admin passwords e.g. `squidlysound,desty,kryptid,bracci,oracle,lesbreehonest` |

To update: **Netlify → Site → Environment Variables → edit → Trigger deploy**

Passwords are case-insensitive. Multiple passwords per type are supported.

---

## Admin Panel

Enter any admin password on the lock screen to access:

- **Live Stats** — views, unlocks, fails, unique visitors, 7-day chart, recent activity (from Google Sheets)
- **Guest Message** — per-flyer, per-admin message shown as animated console text below each flyer
  - Select a flyer from the dropdown
  - Type your message (supports multiple lines)
  - Hit **Save** to post or **Clear** to remove your message
  - Each admin sees and edits only their own message
  - Guests see all active messages in a scrolling carousel with admin display names
- **Exit Admin** — returns to lock screen

### Admin Display Names

| Password | Display Name |
|---|---|
| `squidlysound` | Squidly |
| `desty` | Desty |
| `lesbreehonest` | Lesbreehonest |
| `kryptid` | Kryptid |
| `bracci` | Bracci |
| `oracle` | Oracle |

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

## Google Sheets Structure

| Tab | Contents |
|---|---|
| `Events` | One row per event: `type, timestamp, date ET, time ET, ip_hash, user_agent` |
| `Message1` | Admin messages for flyer 1 — columns: `admin, message` |
| `Message2` | Admin messages for flyer 2 |
| `MessageN` | Auto-created on first save for each flyer |

**Events tab headers:** `type | timestamp | date | time | ip_hash | user_agent`

**Timezone filtering:** Only Eastern Time visitors (UTC-4/UTC-5) are logged.

### Google Sheets Setup

1. Create a Google Sheet named `Duval Sound Stats`
2. Add a tab called `Events` with the headers above
3. Enable **Google Sheets API** in Google Cloud Console
4. Create a **Service Account** → download the JSON key
5. Share the sheet with the service account `client_email` as Editor
6. Add `GOOGLE_SHEET_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON` to Netlify env vars

---

## GitHub Action

The `update-flyers.yml` action runs automatically whenever you push changes to the `/flyers/` folder. It:

1. Scans `/flyers/` for supported media files
2. Sorts them alphabetically
3. Writes `flyers.json`
4. Commits and pushes the updated manifest

No manual `flyers.json` edits needed — ever.

---

## Deploying Changes

Push to `main` → Netlify auto-deploys in ~30 seconds.

**To update media:** Drop files into `/flyers/` on GitHub → Action runs → Netlify deploys.  
**To update passwords:** Edit env vars in Netlify → Trigger deploy.  
**To update admin messages:** Log in with admin password → Guest Message section.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Hosting | Netlify (static + functions) |
| Auth | Netlify Functions (server-side) |
| Database | Google Sheets via googleapis |
| Analytics | Google Analytics (`G-9XVF3WYZ61`) |
| CI/CD | GitHub Actions (manifest auto-update) |
| Frontend | Vanilla HTML / CSS / Canvas API |
| Fonts | Bebas Neue, Space Mono, Orbitron (Google Fonts) |
| Version control | GitHub (private repo) |

---

## Analytics

Custom GA4 events:
- `flyer_view` — page load
- `flyer_unlock` — correct password entered  
- `flyer_fail` — wrong password attempt

View in: **GA → Reports → Engagement → Events**

---

*Duval Sound · Jacksonville, FL*
