// netlify/functions/set-message.js
// Saves or clears one admin's message row for a specific flyer.
// Body: { message, flyer (filename), password }
//
// Tabs are keyed by flyer FILENAME so they stay correct when flyers are
// archived or reordered. Tab is created on first save for that flyer.

const { google } = require("googleapis");

function tabNameFor(flyerFile) {
  let base = String(flyerFile || "").replace(/^flyers\//, "").replace(/^archive\//, "");
  base = base.replace(/\.[^.]+$/, "");
  base = base.replace(/[:\\\/\?\*\[\]]/g, "-");
  base = base.slice(0, 90);
  return "msg_" + base;
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const body = JSON.parse(event.body);
    const { message, password, flyer } = body;
    const adminKey = (password || "").toLowerCase().trim();

    if (!adminKey) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing password", success: false }) };
    }
    if (!flyer) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing flyer", success: false }) };
    }
    if (message === undefined) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing message", success: false }) };
    }

    const tabName = tabNameFor(flyer);

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Read the tab, creating it if this is the first message for this flyer
    let rows = [];
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: tabName + "!A:B",
      });
      rows = response.data.values || [];
    } catch (e) {
      if (e.message && e.message.includes("Unable to parse range")) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: tabName } } }],
          },
        });
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

    if (!rows.length || rows[0][0] !== "admin") {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: tabName + "!A1:B1",
        valueInputOption: "RAW",
        requestBody: { values: [["admin", "message"]] },
      });
      rows = [["admin", "message"], ...rows];
    }

    // Find this admin's existing row
    let adminRowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] && rows[i][0].toLowerCase() === adminKey) {
        adminRowIndex = i;
        break;
      }
    }

    if (adminRowIndex !== -1) {
      const sheetRow = adminRowIndex + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: tabName + "!A" + sheetRow + ":B" + sheetRow,
        valueInputOption: "RAW",
        requestBody: { values: [[adminKey, message]] },
      });
    } else {
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
