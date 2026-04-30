// netlify/functions/log-event.js
// Appends a row to Google Sheets for local visitors only
// Filters by UTC offset: EDT = 240, EST = 300 (Jacksonville, FL)
// All date/time derived server-side from UTC timestamp for consistency

const { google } = require("googleapis");

// Jacksonville is US Eastern:
// EDT (Mar–Nov): UTC-4 = offset 240 minutes
// EST (Nov–Mar): UTC-5 = offset 300 minutes
const ALLOWED_OFFSETS = [240, 300];

function hashIP(ip) {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    hash = ((hash << 5) - hash) + ip.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36).toUpperCase();
}

function formatUTCDate(date) {
  // Convert UTC to Eastern time for display
  const month = date.getUTCMonth();
  // Rough DST: EDT Mar-Nov, EST Nov-Mar
  const isDST = month >= 2 && month <= 10;
  const offsetHours = isDST ? -4 : -5;
  const local = new Date(date.getTime() + offsetHours * 3600 * 1000);

  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const dateStr = months[local.getUTCMonth()] + " " + local.getUTCDate() + ", " + local.getUTCFullYear();

  let hours = local.getUTCHours();
  const mins = local.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const timeStr = hours + ":" + mins + " " + ampm + " ET";

  return { dateStr, timeStr };
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { type, timestamp, tzOffset } = JSON.parse(event.body);

    // Timezone filter — only log Eastern time visitors
    const offset = parseInt(tzOffset, 10);
    if (!ALLOWED_OFFSETS.includes(offset)) {
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, skipped: true })
      };
    }

    // Derive consistent date/time from UTC timestamp server-side
    const date = new Date(timestamp);
    const { dateStr, timeStr } = formatUTCDate(date);

    // IP hash
    const rawIP =
      (event.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      event.headers["x-nf-client-connection-ip"] ||
      event.headers["client-ip"] ||
      "unknown";
    const ipHash = hashIP(rawIP);

    // User agent (shortened)
    const ua = (event.headers["user-agent"] || "unknown")
      .replace(/\(.*?\)/g, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .join(" ")
      .substring(0, 40);

    // Write to Google Sheets
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Events!A:F",
      valueInputOption: "RAW",
      requestBody: {
        values: [[type, timestamp, dateStr, timeStr, ipHash, ua]],
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
