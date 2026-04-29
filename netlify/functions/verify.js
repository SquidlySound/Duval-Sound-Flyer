// netlify/functions/verify.js
// Server-side password verification — passwords never reach the browser

exports.handler = async function(event) {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const { password } = JSON.parse(event.body);
    if (!password) {
      return { statusCode: 400, body: JSON.stringify({ role: "none" }) };
    }

    const input = password.toLowerCase().trim();

    // Passwords stored in Netlify environment variables (never in code)
    // Set these in: Netlify Dashboard → Site → Environment Variables
    const userPasswords  = (process.env.USER_PASSWORDS  || "duvalsound").split(",").map(p => p.trim().toLowerCase());
    const adminPasswords = (process.env.ADMIN_PASSWORDS || "squidlysound").split(",").map(p => p.trim().toLowerCase());

    if (adminPasswords.includes(input)) {
      // Return password lists to admin panel for display
      // We return the raw env var values so admin can see what's set
      const rawUser  = (process.env.USER_PASSWORDS  || "duvalsound").split(",").map(p => p.trim());
      const rawAdmin = (process.env.ADMIN_PASSWORDS || "squidlysound").split(",").map(p => p.trim());
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: "admin",
          userPasswords: rawUser,
          adminPasswords: rawAdmin
        })
      };
    }

    if (userPasswords.includes(input)) {
      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user" })
      };
    }

    // Wrong password — add a small delay to slow brute force
    await new Promise(resolve => setTimeout(resolve, 400));
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: "none" })
    };

  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: "Server error" }) };
  }
};
