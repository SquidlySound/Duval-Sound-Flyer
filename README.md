# Duval Sound Flyer — Netlify Setup

## Files to upload to your GitHub repo

```
index.html
flyer.png
netlify.toml
robots.txt
netlify/
  functions/
    verify.js
    manage-passwords.js
```

---

## Step 1 — Connect GitHub to Netlify

1. Go to **netlify.com** and sign up / log in
2. Click **Add new site → Import an existing project**
3. Choose **GitHub** and select your `duval-sound-flyer` repo
4. Build settings — leave everything default (Netlify will detect `netlify.toml`)
5. Click **Deploy site**

---

## Step 2 — Set your passwords as Environment Variables

This is how passwords stay out of your source code.

1. In Netlify: go to **Site → Environment Variables**
2. Add these two variables:

| Key | Value |
|-----|-------|
| `USER_PASSWORDS` | `duvalsound` |
| `ADMIN_PASSWORDS` | `squidlysound` |

For multiple passwords, separate with commas:
- `USER_PASSWORDS` → `duvalsound,password2,vippass`
- `ADMIN_PASSWORDS` → `squidlysound,otheradmin`

3. Click **Save** then **Trigger deploy** to apply

---

## Step 3 — Set up password management API (optional)

If you want the admin panel to save password changes permanently
(instead of just for the session), add two more env vars:

| Key | Value |
|-----|-------|
| `NETLIFY_SITE_ID` | Your site ID (found in Site → General → Site ID) |
| `NETLIFY_API_KEY` | A personal access token from app.netlify.com/user/applications |

---

## Step 4 — Update your QR code URL

Your new Netlify URL will look like `https://yoursite.netlify.app`
Paste it here to get a new QR code generated.

---

## Updating the flyer

1. Rename your new flyer image to `flyer.png`
2. Push it to your GitHub repo (replacing the old one)
3. Netlify auto-deploys within seconds — no other changes needed

---

## Passwords

- **Guest password:** set in `USER_PASSWORDS` env var
- **Admin password:** set in `ADMIN_PASSWORDS` env var
- Passwords are **never** in the HTML source code
- Changes made in the admin panel persist if `NETLIFY_API_KEY` is set
