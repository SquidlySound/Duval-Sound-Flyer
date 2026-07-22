// netlify/functions/set-profile.js
// Saves an admin's profile (bio, socials, track link) to Google Sheets.
// If a photo is included, uploads it to the GitHub repo under member-photos/
// and stores the resulting raw URL in the sheet.
//
// Requires these Netlify env vars for photo upload:
//   GITHUB_TOKEN        - personal access token with repo write access
//   GITHUB_REPO_OWNER    - e.g. "SquidlySound"
//   GITHUB_REPO_NAME     - e.g. "Duval-Sound-Flyer"
//
// If those aren't set, profile text still saves — photo upload is skipped gracefully.

const { google } = require("googleapis");

async function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function uploadPhotoToGitHub(adminKey, base64DataUrl) {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo  = process.env.GITHUB_REPO_NAME;

  if (!token || !owner || !repo) {
    console.warn("GitHub photo upload skipped — missing env vars");
    return null;
  }

  // Parse the data URL: data:image/png;base64,xxxxx
  const match = base64DataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;
  const ext = match[1] === "jpeg" ? "jpg" : match[1];
  const base64Content = match[2];

  const filePath = `member-photos/${adminKey}.${ext}`;
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

  // Check if file already exists (need its sha to update)
  let sha = null;
  try {
    const existing = await fetch(apiUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
      },
    });
    if (existing.ok) {
      const existingData = await existing.json();
      sha = existingData.sha;
    }
  } catch (e) {
    // File doesn't exist yet — that's fine
  }

  const body = {
    message: `Update profile photo for ${adminKey}`,
    content: base64Content,
    branch: "main",
  };
  if (sha) body.sha = sha;

  const res = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error("GitHub upload failed: " + errText);
  }

  // Return the raw GitHub URL (works immediately, doesn't need Netlify redeploy)
  return `https://raw.githubusercontent.com/${owner}/${repo}/main/${filePath}`;
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
      return { statusCode: 400, body: JSON.stringify({ error: "Missing password", success: false }) };
    }

    // Upload photo if provided
    let photoUrl = null;
    if (photoBase64) {
      try {
        photoUrl = await uploadPhotoToGitHub(adminKey, photoBase64);
      } catch (e) {
        console.error("Photo upload error:", e.message);
        // Continue saving text fields even if photo fails
      }
    }

    const sheets = await getSheets();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Ensure Members tab exists
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

    // Find this admin's row
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toLowerCase() === adminKey) {
        rowIndex = i;
        break;
      }
    }

    // Preserve existing photoUrl if no new photo was uploaded
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
