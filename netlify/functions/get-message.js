// netlify/functions/get-message.js
// Returns the current guest message from Google Sheets

const { google } = require("googleapis");

exports.handler = async function(event) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Read from Message tab, cell A2 (A1 is header)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Message!A2",
    });

    const rows = response.data.values || [];
    const message = rows[0] ? rows[0][0] : "";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    };
  } catch (e) {
    // If the Message tab doesn't exist yet, return empty message
    if (e.message && e.message.includes("Unable to parse range")) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "" }),
      };
    }
    console.error("get-message error:", e.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
