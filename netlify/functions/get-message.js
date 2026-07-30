// netlify/functions/get-message.js
// Guest mode: returns all named admin messages for a flyer
// Admin mode: returns just this admin's message (?admin=password)
//
// Tabs are keyed by FLYER FILENAME, not by position in the list. This matters:
// if tabs were indexed (Message1, Message2...), archiving one flyer would shift
// every later flyer onto the wrong tab and silently scramble the messages.
//
//   ?flyer=2026-08-15_desty-kryptid.png  ->  tab "msg_2026-08-15_desty-kryptid"

const { google } = require("googleapis");

const ADMIN_NAMES = {
  "squidlysound":  "Squidly",
  "desty":         "Desty",
  "lesbreehonest": "Lesbreehonest",
  "kryptid":       "Kryptid",
  "bracci":        "Bracci",
  "oracle":        "Oracle",
};

function getDisplayName(password) {
  return ADMIN_NAMES[password.toLowerCase()] || password;
}

// Turns a flyer filename into a stable, Sheets-safe tab name.
// Google Sheets tab names cap at 100 chars and reject : \ / ? * [ ]
function tabNameFor(flyerFile) {
  let base = String(flyerFile || "").replace(/^flyers\//, "").replace(/^archive\//, "");
  base = base.replace(/\.[^.]+$/, "");            // drop extension
  base = base.replace(/[:\\\/\?\*\[\]]/g, "-");   // strip Sheets-illegal chars
  base = base.slice(0, 90);
  return "msg_" + base;
}

exports.handler = async function(event) {
  try {
    const params = event.queryStringParameters || {};
    const flyerFile = params.flyer || "";
    if (!flyerFile) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Missing flyer parameter" }),
      };
    }
    const tabName = tabNameFor(flyerFile);
    const adminPw = (params.admin || "").toLowerCase().trim();

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
        // Tab doesn't exist yet — no messages posted for this flyer
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(adminPw ? { adminMessage: "" } : { messages: [] }),
        };
      }
      throw e;
    }

    const dataRows = rows.filter(r => r[0] && r[0] !== "admin");

    function rowToEntry(row) {
      return { name: getDisplayName(row[0]), message: row[1] || "" };
    }

    // Admin mode — just this admin's own message, for editing
    if (adminPw) {
      const adminRow = dataRows.find(r => r[0].toLowerCase() === adminPw);
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminMessage: adminRow ? (adminRow[1] || "") : "" }),
      };
    }

    // Guest mode — every non-empty message with its display name
    const messages = dataRows
      .filter(r => r[1] && r[1].trim())
      .map(rowToEntry);

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
