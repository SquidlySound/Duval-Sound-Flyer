// netlify/functions/set-message.js
// Saves or clears this admin's message row for a specific flyer
// Body: { message, flyer, password }

const { google } = require("googleapis");

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const body     = JSON.parse(event.body);
    const { message, password } = body;
    const flyerNum = parseInt(body.flyer || 1, 10);
    const tabName  = "Message" + flyerNum;
    const adminKey = (password || "").toLowerCase().trim();

    if (!adminKey) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing password", success: false }) };
    }
    if (message === undefined) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing message", success: false }) };
    }

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Ensure the tab exists
    let rows = [];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: tabName + "!A:B",
      });
      rows = response.data.values || [];
    } catch (e) {
      if (e.message && e.message.includes("Unable to parse range")) {
        // Create the tab
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: tabName } } }]
          }
        });
        // Write header
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: tabName + "!A1:B1",
          valueInputOption: "RAW",
          requestBody: { values: [["admin", "message"]] },
        });
        rows = [["admin", "message"]];
      } else {
        throw e;
      }
    }

    // Ensure header exists
    if (!rows.length || rows[0][0] !== "admin") {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: tabName + "!A1:B1",
        valueInputOption: "RAW",
        requestBody: { values: [["admin", "message"]] },
      });
      rows = [["admin", "message"], ...rows];
    }

    // Find this admin's row (skip header at index 0)
    let adminRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toLowerCase() === adminKey) {
        adminRowIndex = i;
        break;
      }
    }

    if (adminRowIndex !== -1) {
      // Update existing row (sheet rows are 1-indexed, +1 for header)
      const sheetRow = adminRowIndex + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: tabName + "!A" + sheetRow + ":B" + sheetRow,
        valueInputOption: "RAW",
        requestBody: { values: [[adminKey, message]] },
      });
    } else {
      // Append new row for this admin
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: tabName + "!A:B",
        valueInputOption: "RAW",
        requestBody: { values: [[adminKey, message]] },
      });
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true }),
    };
  } catch (e) {
    console.error("set-message error:", e.message);
    return { statusCode: 500, body: JSON.stringify({ error: e.message, success: false }) };
  }
};
