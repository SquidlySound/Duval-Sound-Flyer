// netlify/functions/set-profile.js
// Saves an admin's profile to Google Sheets (bio, socials, track link).
// Profile photos are stored in Netlify Blobs — no GitHub commits, no rebuilds,
// no filename issues, and the photo is live the instant the write succeeds.
//
// Photos are keyed by the admin's password (lowercased), e.g. "squidlysound".
// The Sheets photoUrl column stores a link to the get-photo function, which
// streams the image back out of Blobs.

const { google } = require("googleapis");
const { getStore } = require("@netlify/blobs");

const PHOTO_STORE = "member-photos";

async function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

// Stores the image bytes in Netlify Blobs and returns the public URL
// that will serve it back (via the get-photo function).
async function uploadPhotoToBlobs(adminKey, base64DataUrl) {
  const match = base64DataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) throw new Error("Invalid image data format");

  const rawExt = match[1].toLowerCase();
  const ext = rawExt === "jpeg" ? "jpg" : rawExt;
  const contentType = "image/" + (ext === "jpg" ? "jpeg" : ext);
  const buffer = Buffer.from(match[2], "base64");

  const store = getStore(PHOTO_STORE);
  await store.set(adminKey, buffer, {
    metadata: {
      contentType: contentType,
      ext: ext,
      updatedAt: new Date().toISOString(),
    },
  });

  // Cache-busting param so an updated photo shows immediately instead of
  // serving a stale cached copy from the browser.
  return "/.netlify/functions/get-photo?admin=" +
         encodeURIComponent(adminKey) +
         "&v=" + Date.now();
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const { password, bio, instagram, soundcloud, spotify, track, photoBase64 } = body;
    const adminKey = (password || "").toLowerCase().trim();

    if (!adminKey) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing password", success: false }),
      };
    }

    // Upload photo first — if it fails, report it rather than silently
    // saving text fields and pretending the whole save succeeded.
    let photoUrl = null;
    if (photoBase64) {
      try {
        photoUrl = await uploadPhotoToBlobs(adminKey, photoBase64);
      } catch (e) {
        console.error("Photo upload error:", e.message);
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: false,
            error: "Photo upload failed: " + e.message,
            photoError: e.message,
          }),
        };
      }
    }

    const sheets = await getSheets();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    let rows = [];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Members!A:G",
      });
      rows = response.data.values || [];
    } catch (e) {
      if (e.message && e.message.includes("Unable to parse range")) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: "Members" } } }],
          },
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "Members!A1:G1",
          valueInputOption: "RAW",
          requestBody: {
            values: [["admin", "bio", "photoUrl", "instagram", "soundcloud", "spotify", "track"]],
          },
        });
        rows = [["admin", "bio", "photoUrl", "instagram", "soundcloud", "spotify", "track"]];
      } else {
        throw e;
      }
    }

    if (!rows.length || rows[0][0] !== "admin") {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Members!A1:G1",
        valueInputOption: "RAW",
        requestBody: {
          values: [["admin", "bio", "photoUrl", "instagram", "soundcloud", "spotify", "track"]],
        },
      });
      rows = [["admin", "bio", "photoUrl", "instagram", "soundcloud", "spotify", "track"], ...rows];
    }

    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toLowerCase() === adminKey) {
        rowIndex = i;
        break;
      }
    }

    // Keep the existing photo link if this save didn't include a new photo
    const existingPhotoUrl = rowIndex !== -1 ? (rows[rowIndex][2] || "") : "";
    const finalPhotoUrl = photoUrl || existingPhotoUrl;

    const newRow = [
      adminKey,
      bio || "",
      finalPhotoUrl,
      instagram || "",
      soundcloud || "",
      spotify || "",
      track || "",
    ];

    if (rowIndex !== -1) {
      const sheetRow = rowIndex + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Members!A" + sheetRow + ":G" + sheetRow,
        valueInputOption: "RAW",
        requestBody: { values: [newRow] },
      });
    } else {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: "Members!A:G",
        valueInputOption: "RAW",
        requestBody: { values: [newRow] },
      });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, photoUrl: finalPhotoUrl }),
    };
  } catch (e) {
    console.error("set-profile error:", e.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message, success: false }),
    };
  }
};
