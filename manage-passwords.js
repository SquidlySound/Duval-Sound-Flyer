// netlify/functions/manage-passwords.js
// Add or remove passwords — updates Netlify env vars via the Netlify API

exports.handler = async function(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { action, password, role } = JSON.parse(event.body);

    if (!action || !password || !role) {
      return { statusCode: 400, body: JSON.stringify({ error: "Missing fields" }) };
    }

    const envKey = role === "admin" ? "ADMIN_PASSWORDS" : "USER_PASSWORDS";
    const current = (process.env[envKey] || "").split(",").map(p => p.trim()).filter(Boolean);

    let updated;

    if (action === "add") {
      if (current.map(p => p.toLowerCase()).includes(password.toLowerCase())) {
        return { statusCode: 200, body: JSON.stringify({ error: "Password already exists", success: false }) };
      }
      updated = [...current, password.trim()];
    } else if (action === "remove") {
      if (current.length <= 1) {
        return { statusCode: 200, body: JSON.stringify({ error: "Cannot remove the last password", success: false }) };
      }
      updated = current.filter(p => p.toLowerCase() !== password.toLowerCase());
    } else {
      return { statusCode: 400, body: JSON.stringify({ error: "Unknown action" }) };
    }

    // Update the env var via Netlify API
    const siteId  = process.env.NETLIFY_SITE_ID;
    const apiKey  = process.env.NETLIFY_API_KEY;

    if (!siteId || !apiKey) {
      // Env vars not configured — return success for session-only change
      // The admin panel will update in-memory but changes won't persist
      const userList  = (process.env.USER_PASSWORDS  || "duvalsound").split(",").map(p => p.trim());
      const adminList = (process.env.ADMIN_PASSWORDS || "squidlysound").split(",").map(p => p.trim());
      if (role === "admin") adminList.splice(0, adminList.length, ...updated);
      else userList.splice(0, userList.length, ...updated);
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          sessionOnly: true,
          userPasswords: role === "user" ? updated : userList,
          adminPasswords: role === "admin" ? updated : adminList
        })
      };
    }

    // Persist change via Netlify API
    const response = await fetch(
      `https://api.netlify.com/api/v1/sites/${siteId}/env/${envKey}`,
      {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          value: updated.join(",")
        })
      }
    );

    if (!response.ok) {
      const err = await response.text();
      return { statusCode: 500, body: JSON.stringify({ error: "API error: " + err, success: false }) };
    }

    // Return updated lists
    const rawUser  = role === "user"  ? updated : (process.env.USER_PASSWORDS  || "duvalsound").split(",").map(p => p.trim());
    const rawAdmin = role === "admin" ? updated : (process.env.ADMIN_PASSWORDS || "squidlysound").split(",").map(p => p.trim());

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        userPasswords: rawUser,
        adminPasswords: rawAdmin
      })
    };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server error: " + e.message, success: false }) };
  }
};
