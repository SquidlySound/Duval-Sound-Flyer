// netlify/functions/get-config.js
// Reads the Config tab from Google Sheets for flyer display order.
// Auto-creates the tab if it doesn't exist, populated from flyers.json.
//
// Config tab format (A=key, B=value):
//   flyer_order | direct support.png,flyer1.mp4

const { google } = require("googleapis");
const fs   = require("fs");
const path = require("path");

async function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function createConfigTab(sheets, spreadsheetId) {
  // Read flyers.json for current flyer order
  let flyerOrder = [];
  try {
    const flyersPath = path.join(process.cwd(), "flyers.json");
    if (fs.existsSync(flyersPath)) {
      flyerOrder = JSON.parse(fs.readFileSync(flyersPath, "utf8"));
    }
  } catch (e) {
    console.warn("Could not read flyers.json:", e.message);
  }

  const rows = [
    ["key", "value"],
    ["flyer_order", flyerOrder.join(",")],
  ];

  try {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: "Config" } } }],
      },
    });
  } catch (e) {
    if (!e.message.includes("already exists")) throw e;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Config!A1",
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });

  console.log("Config tab created with flyer_order:", flyerOrder.join(","));
  return rows.slice(1);
}

exports.handler = async function(event) {
  try {
    const sheets = await getSheets();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    let rows = [];
    let needsCreate = false;

    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Config!A:B",
      });
      const allRows = response.data.values || [];
      rows = allRows.filter(r => r[0] && r[0] !== "key");
    } catch (e) {
      if (e.message && e.message.includes("Unable to parse range")) {
        needsCreate = true;
      } else {
        throw e;
      }
    }

    if (needsCreate || rows.length === 0) {
      rows = await createConfigTab(sheets, spreadsheetId);
    }

    const config = { flyerOrder: [] };
    rows.forEach(function(row) {
      if (!row[0]) return;
      const key   = row[0].trim().toLowerCase();
      const value = (row[1] || "").trim();
      if (key === "flyer_order" && value) {
        config.flyerOrder = value.split(",").map(f => f.trim()).filter(Boolean);
      }
    });

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "max-age=60",
      },
      body: JSON.stringify(config),
    };
  } catch (e) {
    console.error("get-config error:", e.message);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flyerOrder: [] }),
    };
  }
};
