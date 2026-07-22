// netlify/functions/get-config.js
// Syncs the Config tab's flyer_order with flyers.json:
//  - New files are appended (flyers.json is already sorted by upload date, newest first)
//  - Deleted files are removed from the order
//  - Your manual reordering of existing files is PRESERVED
// Returns: { flyerOrder: [...] }

const { google } = require("googleapis");

async function getSheets() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

async function fetchManifest() {
  // Fetch the live flyers.json from the deployed site
  const siteUrl = process.env.URL || "https://dsflyerdrop.netlify.app";
  try {
    const res = await fetch(siteUrl + "/flyers.json?v=" + Date.now());
    if (!res.ok) return [];
    const manifest = await res.json();
    return Array.isArray(manifest) ? manifest : [];
  } catch (e) {
    console.warn("Could not fetch flyers.json:", e.message);
    return [];
  }
}

exports.handler = async function(event) {
  try {
    const sheets = await getSheets();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // 1. Get current manifest (sorted by upload date, newest first)
    const manifest = await fetchManifest();

    // 2. Read existing Config tab
    let sheetOrder = [];
    let tabExists = true;
    try {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Config!A:B",
      });
      const rows = (response.data.values || []).filter(r => r[0] && r[0] !== "key");
      const orderRow = rows.find(r => r[0].trim().toLowerCase() === "flyer_order");
      if (orderRow && orderRow[1]) {
        sheetOrder = orderRow[1].split(",").map(f => f.trim()).filter(Boolean);
      }
    } catch (e) {
      if (e.message && e.message.includes("Unable to parse range")) {
        tabExists = false;
      } else {
        throw e;
      }
    }

    // 3. Sync: keep user's order for existing files, remove deleted, add new
    const manifestSet = new Set(manifest);
    // Keep only files that still exist, in the user's order
    const kept = sheetOrder.filter(f => manifestSet.has(f));
    // Find new files not yet in the sheet order (manifest order = upload date)
    const keptSet = new Set(kept);
    const added = manifest.filter(f => !keptSet.has(f));
    // New files go on top (newest first), then user-ordered existing files
    const finalOrder = [...added, ...kept];

    // 4. Write back to sheet if changed or tab missing
    const orderChanged = finalOrder.join(",") !== sheetOrder.join(",");
    if (!tabExists) {
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
    }
    if (!tabExists || orderChanged) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Config!A1:B2",
        valueInputOption: "RAW",
        requestBody: {
          values: [
            ["key", "value"],
            ["flyer_order", finalOrder.join(",")],
          ],
        },
      });
      console.log("Config synced. flyer_order:", finalOrder.join(","));
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flyerOrder: finalOrder }),
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
