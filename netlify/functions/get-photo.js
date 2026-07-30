// netlify/functions/get-photo.js
// Serves an admin's profile photo out of Netlify Blobs.
//
// Usage:  /.netlify/functions/get-photo?admin=squidlysound
//
// Blobs aren't publicly addressable on their own, so this function acts as the
// public URL for each photo. Returns the raw image bytes with the correct
// content-type, so it can be used directly as an <img src="...">.

const { getStore } = require("@netlify/blobs");

const PHOTO_STORE = "member-photos";

// 1x1 transparent PNG — served when an admin has no photo yet, so the
// <img> tag fails gracefully instead of showing a broken-image icon.
const BLANK_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

exports.handler = async function(event) {
  const params = event.queryStringParameters || {};
  const adminKey = (params.admin || "").toLowerCase().trim();

  if (!adminKey) {
    return { statusCode: 400, body: "Missing admin parameter" };
  }

  try {
    const store = getStore(PHOTO_STORE);
    const result = await store.getWithMetadata(adminKey, { type: "arrayBuffer" });

    if (!result || !result.data) {
      // No photo stored for this admin — return the transparent placeholder
      return {
        statusCode: 200,
        headers: {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=60",
        },
        body: BLANK_PNG_BASE64,
        isBase64Encoded: true,
      };
    }

    const contentType =
      (result.metadata && result.metadata.contentType) || "image/png";
    const base64Body = Buffer.from(result.data).toString("base64");

    return {
      statusCode: 200,
      headers: {
        "Content-Type": contentType,
        // Short cache — the URL includes a ?v= timestamp that changes on every
        // upload, so a new photo busts the cache immediately anyway.
        "Cache-Control": "public, max-age=300",
      },
      body: base64Body,
      isBase64Encoded: true,
    };
  } catch (e) {
    console.error("get-photo error:", e.message);
    // Fail soft with the placeholder rather than a broken image
    return {
      statusCode: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "no-cache" },
      body: BLANK_PNG_BASE64,
      isBase64Encoded: true,
    };
  }
};
