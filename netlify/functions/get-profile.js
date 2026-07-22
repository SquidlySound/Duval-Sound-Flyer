// netlify/functions/get-profile.js
// Reads member profile data from the Members tab in Google Sheets.
//
// ?admin=password  -> returns just that admin's profile (for editing)
// ?all=true        -> returns all profiles keyed by lowercase name (for public display)
//
// Members tab format (A=admin, B=bio, C=photoUrl, D=instagram, E=soundcloud, F=spotify, G=track)

const { google } = require("googleapis");

const ADMIN_NAMES = {
  "squidlysound":  "Squidly",
  "desty":         "Desty",
  "lesbreehonest": "Lesbreehonest",
  "kryptid":       "Kryptid",
  "bracci":        "Bracci",
  "oracle":        "Oracle",
};

async function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return google.sheets({ version: "v4", auth });
}

exports.handler = async function(event) {
  try {
    const params  = event.queryStringParameters || {};
    const sheets  = await getSheets();
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
        // Tab doesn't exist yet
        if (params.all) {
          return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) };
        }
        return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) };
      }
      throw e;
    }

    const dataRows = rows.filter(r => r[0] && r[0] !== "admin");

    function rowToProfile(row) {
      return {
        bio:        row[1] || "",
        photoUrl:   row[2] || "",
        instagram:  row[3] || "",
        soundcloud: row[4] || "",
        spotify:    row[5] || "",
        track:      row[6] || "",
      };
    }

    if (params.all) {
      // Return all profiles keyed by lowercase display name (matches MEMBERS array in frontend)
      const result = {};
      dataRows.forEach(function(row) {
        const adminKey = row[0].toLowerCase();
        const displayName = (ADMIN_NAMES[adminKey] || adminKey).toLowerCase();
        result[displayName] = rowToProfile(row);
      });
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      };
    }

    // Single admin profile
    const adminKey = (params.admin || "").toLowerCase().trim();
    const row = dataRows.find(r => r[0].toLowerCase() === adminKey);
    const profile = row ? rowToProfile(row) : {};

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    };
  } catch (e) {
    console.error("get-profile error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
