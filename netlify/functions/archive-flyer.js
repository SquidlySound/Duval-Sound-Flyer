// netlify/functions/archive-flyer.js
// Moves a flyer from flyers/ to archive/ in GitHub, and deletes that flyer's
// message tab from the Google Sheet so the sheet stays clean.
//
// Body: { flyer: "2026-08-15_desty-kryptid.png", password: "<admin password>" }
//
// Uses the Git Data API rather than the Contents API. The Contents API caps
// file reads at 1MB, which flyers routinely exceed. The Git Data API moves the
// file by referencing its existing blob SHA, so nothing is re-uploaded and file
// size is irrelevant.
//
// Requires: GITHUB_TOKEN, GITHUB_REPO_OWNER, GITHUB_REPO_NAME

const { google } = require("googleapis");

const BRANCH = "main";

function tabNameFor(flyerFile) {
  let base = String(flyerFile || "").replace(/^flyers\//, "").replace(/^archive\//, "");
  base = base.replace(/\.[^.]+$/, "");
  base = base.replace(/[:\\\/\?\*\[\]]/g, "-");
  base = base.slice(0, 90);
  return "msg_" + base;
}

function gh(path, token, options) {
  const owner = process.env.GITHUB_REPO_OWNER;
  const repo  = process.env.GITHUB_REPO_NAME;
  return fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "Content-Type": "application/json",
      ...(options && options.headers ? options.headers : {}),
    },
  });
}

async function ghJson(path, token, options) {
  const res = await gh(path, token, options);
  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try { msg = JSON.parse(text).message || text; } catch (e) {}
    throw new Error(`GitHub ${path} failed (HTTP ${res.status}): ${msg}`);
  }
  return res.json();
}

// True git move: build a new tree that removes the old path and adds the
// existing blob at the new path, then commit and advance the branch.
async function moveFileInRepo(token, fromPath, toPath) {
  // 1. Blob SHA of the file being moved
  const fileInfo = await ghJson(`/contents/${encodeURI(fromPath)}?ref=${BRANCH}`, token);
  const blobSha = fileInfo.sha;

  // 2. Current branch head + its tree
  const ref    = await ghJson(`/git/ref/heads/${BRANCH}`, token);
  const commit = await ghJson(`/git/commits/${ref.object.sha}`, token);

  // 3. New tree: delete old path (sha:null), add same blob at new path
  const newTree = await ghJson(`/git/trees`, token, {
    method: "POST",
    body: JSON.stringify({
      base_tree: commit.tree.sha,
      tree: [
        { path: fromPath, mode: "100644", type: "blob", sha: null },
        { path: toPath,   mode: "100644", type: "blob", sha: blobSha },
      ],
    }),
  });

  // 4. Commit it
  const newCommit = await ghJson(`/git/commits`, token, {
    method: "POST",
    body: JSON.stringify({
      message: `Archive flyer: ${fromPath.split("/").pop()}`,
      tree: newTree.sha,
      parents: [ref.object.sha],
    }),
  });

  // 5. Advance the branch
  await ghJson(`/git/refs/heads/${BRANCH}`, token, {
    method: "PATCH",
    body: JSON.stringify({ sha: newCommit.sha }),
  });

  return newCommit.sha;
}

async function deleteMessageTab(flyerFile) {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const tabName = tabNameFor(flyerFile);

  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = (meta.data.sheets || []).find(
    s => s.properties && s.properties.title === tabName
  );

  if (!sheet) return { deleted: false, reason: "no tab existed" };

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ deleteSheet: { sheetId: sheet.properties.sheetId } }],
    },
  });
  return { deleted: true, tab: tabName };
}

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  try {
    const { flyer, password } = JSON.parse(event.body);
    const adminKey = (password || "").toLowerCase().trim();

    // Only real admins can archive
    const validAdmins = (process.env.ADMIN_PASSWORDS || "")
      .split(",").map(p => p.trim().toLowerCase()).filter(Boolean);
    if (!adminKey || validAdmins.indexOf(adminKey) === -1) {
      return {
        statusCode: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: "Not authorized" }),
      };
    }

    if (!flyer) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: false, error: "Missing flyer" }),
      };
    }

    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_REPO_OWNER;
    const repo  = process.env.GITHUB_REPO_NAME;
    if (!token || !owner || !repo) {
      const missing = [];
      if (!token) missing.push("GITHUB_TOKEN");
      if (!owner) missing.push("GITHUB_REPO_OWNER");
      if (!repo)  missing.push("GITHUB_REPO_NAME");
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: false,
          error: "Missing Netlify env var(s): " + missing.join(", "),
        }),
      };
    }

    const bare     = String(flyer).replace(/^flyers\//, "");
    const fromPath = "flyers/" + bare;
    const toPath   = "archive/" + bare;

    // Move the file first — if this fails we haven't touched the sheet
    const commitSha = await moveFileInRepo(token, fromPath, toPath);

    // Then clean up the message tab. A failure here isn't fatal: the flyer is
    // already archived, so report it rather than pretending the whole op failed.
    let tabResult;
    try {
      tabResult = await deleteMessageTab(bare);
    } catch (e) {
      console.error("Tab delete failed:", e.message);
      tabResult = { deleted: false, reason: e.message };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        moved: bare,
        commit: commitSha.slice(0, 7),
        messageTab: tabResult,
      }),
    };
  } catch (e) {
    console.error("archive-flyer error:", e.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: false, error: e.message }),
    };
  }
};
