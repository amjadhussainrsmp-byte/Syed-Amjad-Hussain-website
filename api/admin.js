const { createClient } = require("@supabase/supabase-js");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
  const adminEmail = process.env.ADMIN_EMAIL;

  const missing = [];

if (!supabaseUrl) missing.push("SUPABASE_URL");
if (!anonKey) missing.push("SUPABASE_PUBLISHABLE_KEY");
if (!serviceRoleKey) missing.push("SUPABASE_SECRET_KEY");
if (!adminEmail) missing.push("ADMIN_EMAIL");

if (missing.length > 0) {
  console.error("Missing environment variables:", missing);

  return res.status(500).json({
    error: "Server configuration is incomplete.",
    missing
  });
}

  const authorization = req.headers.authorization || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return res.status(401).json({
      error: "Authentication required."
    });
  }

  try {
    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const {
      data: { user },
      error: authError
    } = await authClient.auth.getUser(match[1]);

    if (authError || !user || !user.email) {
      return res.status(401).json({
        error: "Your session is invalid or expired."
      });
    }

    if (user.email.toLowerCase() !== adminEmail.toLowerCase()) {
      return res.status(403).json({
        error: "You are not authorized to access the admin API."
      });
    }

    const adminClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const { data, error } = await adminClient
      .from("site_content")
      .select("id,title,type,slug,category,status,featured,created_at,updated_at")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Admin content query failed:", error.message);
      return res.status(500).json({
        error: "Unable to load content."
      });
    }

    return res.status(200).json({
      authenticated: true,
      email: user.email,
      content: data
    });
  } catch (error) {
    console.error("Admin API error:", error.message);
    return res.status(500).json({
      error: "An unexpected server error occurred."
    });
  }
};
