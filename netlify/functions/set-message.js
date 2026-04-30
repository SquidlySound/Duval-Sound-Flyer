// netlify/functions/set-message.js
// Saves the guest message to Google Sheets (Message tab, cell A2)

const { google } = require("googleapis");

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { message } = JSON.parse(event.body);
    if (message === undefined) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing message field" }) };
    }

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // First ensure the Message sheet exists with a header
    // Try to write header + message — if tab doesn't exist it will fail gracefully
    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Message!A1:A2",
        valueInputOption: "RAW",
        requestBody: {
          values: [["message"], [message]],
        },
      });
    } catch (sheetErr) {
      // Tab may not exist — create it first
      if (sheetErr.message && sheetErr.message.includes("Unable to parse range")) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: { title: "Message" }
              }
            }]
          }
        });
        // Now write
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "Message!A1:A2",
          valueInputOption: "RAW",
          requestBody: {
            values: [["message"], [message]],
          },
        });
      } else {
        throw sheetErr;
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true }),
    };
  } catch (e) {
    console.error("set-message error:", e.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message, success: false }),
    };
  }
};
