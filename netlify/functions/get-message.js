// netlify/functions/get-message.js
// Guest mode: returns all named admin messages for a flyer
// Admin mode: returns just this admin's message (?admin=password)

const { google } = require("googleapis");

const ADMIN_NAMES = {
  "squidlysound":  "Squidly",
  "desty":         "Desty",
  "lesbreehonest": "Lesbreehonest",
  "kryptid":       "Kryptid",
  "bracci":        "Bracci",
  "oracle":        "Oracle"
};

function getDisplayName(password) {
  return ADMIN_NAMES[password.toLowerCase()] || password;
}

exports.handler = async function(event) {
  try {
    const params = event.queryStringParameters || {};
    const flyerNum = parseInt(params.flyer || "1", 10);
    const adminPw  = (params.admin || "").toLowerCase().trim();
    const tabName  = "Message" + flyerNum;

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    let rows = [];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: tabName + "!A:B",
      });
      rows = response.data.values || [];
    } catch (e) {
      if (e.message && e.message.includes("Unable to parse range")) {
        // Tab doesn't exist yet
        if (adminPw) return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adminMessage: "" }) };
        return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: [] }) };
      }
      throw e;
    }

    // Skip header row
    const dataRows = rows.filter(r => r[0] && r[0] !== "admin");

    // Admin mode — return only this admin's message
    if (adminPw) {
      const adminRow = dataRows.find(r => r[0].toLowerCase() === adminPw);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminMessage: adminRow ? (adminRow[1] || "") : "" }),
      };
    }

    // Guest mode — return all non-empty messages with display names
    const messages = dataRows
      .filter(r => r[1] && r[1].trim())
      .map(r => ({ name: getDisplayName(r[0]), message: r[1] }));

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    };
  } catch (e) {
    console.error("get-message error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
