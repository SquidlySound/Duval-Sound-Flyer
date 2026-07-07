// netlify/functions/set-message.js
// Saves the guest message for a specific flyer
// Body: { message: "...", flyer: 1 }

const { google } = require("googleapis");

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const { message } = body;
    const flyerNum = parseInt(body.flyer || 1, 10);
    const tabName = "Message" + flyerNum;

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

    try {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: tabName + "!A1:A2",
        valueInputOption: "RAW",
        requestBody: { values: [["message"], [message]] },
      });
    } catch (sheetErr) {
      if (sheetErr.message && sheetErr.message.includes("Unable to parse range")) {
        // Create the tab first
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: tabName } } }]
          }
        });
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: tabName + "!A1:A2",
          valueInputOption: "RAW",
          requestBody: { values: [["message"], [message]] },
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
