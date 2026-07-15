// netlify/functions/get-stats.js
// Reads all rows from Google Sheets and returns aggregated stats
// admin_unlock events are counted separately and excluded from main totals

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

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Events!A:F",
    });

    const rows = response.data.values || [];
    const dataRows = rows.filter(r => r[0] && r[0] !== "type");

    let views = 0, unlocks = 0, fails = 0, adminUnlocks = 0;
    let todayViews = 0, todayUnlocks = 0;
    const today = new Date().toISOString().slice(0, 10);
    const weekChart = {};
    const recentEvents = [];

    const uniqueVisitors  = new Set();
    const uniqueUnlockers = new Set();
    const todayVisitors   = new Set();

    dataRows.forEach(function(row) {
      const type      = row[0] || "";
      const timestamp = row[1] || "";
      const date      = row[2] || "";
      const time      = row[3] || "";
      const ipHash    = row[4] || "";
      const rowDay    = timestamp.slice(0, 10);

      // Admin unlocks — tracked separately, excluded from main stats
      if (type === "admin_unlock") {
        adminUnlocks++;
        // Don't add to recent events or charts
        return;
      }

      if (type === "view") {
        views++;
        if (rowDay === today) { todayViews++; todayVisitors.add(ipHash); }
        if (ipHash) uniqueVisitors.add(ipHash);
      }
      if (type === "unlock") {
        unlocks++;
        if (rowDay === today) todayUnlocks++;
        if (ipHash) uniqueUnlockers.add(ipHash);
      }
      if (type === "fail") { fails++; }

      // Week chart — last 7 days views only
      const daysDiff = Math.floor((Date.now() - new Date(rowDay).getTime()) / 86400000);
      if (daysDiff >= 0 && daysDiff < 7 && type === "view") {
        weekChart[rowDay] = (weekChart[rowDay] || 0) + 1;
      }

      // Recent events (last 15, excluding admin unlocks)
      if (recentEvents.length < 15) {
        recentEvents.push({ type, date, time, ip: ipHash ? ipHash.slice(0, 6) : "—" });
      }
    });

    recentEvents.reverse();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        views, unlocks, fails, adminUnlocks,
        todayViews, todayUnlocks,
        uniqueVisitors:      uniqueVisitors.size,
        uniqueUnlockers:     uniqueUnlockers.size,
        todayUniqueVisitors: todayVisitors.size,
        weekChart,
        recentEvents,
      }),
    };
  } catch (e) {
    console.error("get-stats error:", e.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
