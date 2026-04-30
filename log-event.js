// netlify/functions/log-event.js
// Appends a row to Google Sheets every time a view/unlock/fail occurs
// Columns: type | timestamp | date | time | ip | user_agent

const { google } = require("googleapis");

// Simple hash so we store a fingerprint not a raw IP (privacy-friendly)
function hashIP(ip) {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = ((hash << 5) - hash) + ip.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).toUpperCase();
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { type, timestamp, date, time } = JSON.parse(event.body);

    // Get visitor IP — Netlify puts it in headers
    const rawIP = 
      event.headers["x-forwarded-for"]?.split(",")[0].trim() ||
      event.headers["x-nf-client-connection-ip"] ||
      event.headers["client-ip"] ||
      "unknown";

    // Hash the IP for privacy — we can still count uniques without storing raw IPs
    const ipHash = hashIP(rawIP);

    // Shorten user agent to just browser/OS
    const ua = (event.headers["user-agent"] || "unknown")
      .replace(/\(.*?\)/g, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .join(" ")
      .substring(0, 40);

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // Append row: [type, timestamp, date, time, ip_hash, user_agent]
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Events!A:F",
      valueInputOption: "RAW",
      requestBody: {
        values: [[type, timestamp, date, time, ipHash, ua]],
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (e) {
    console.error("log-event error:", e.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
