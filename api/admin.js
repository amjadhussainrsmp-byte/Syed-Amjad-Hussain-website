
const { createClient } = require("@supabase/supabase-js");

const ALLOWED_TYPES = [
  "project",
  "article",
  "book",
  "poem",
  "experience",
  "skill",
  "award",
  "heritage"
];

const ALLOWED_STATUSES = ["draft", "published"];

const EDITABLE_FIELDS = [
  "title",
  "type",
  "slug",
  "category",
  "summary",
  "body",
  "image_url",
  "status",
  "featured",
  "sort_order",
  "seo_title",
  "seo_description"
];

function sendError(res, status, error) {
  return res.status(status).json({ error });
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (!["GET", "POST", "PATCH", "DELETE"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return sendError(res, 405, "Method not allowed.");
  }

  const {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    SUPABASE_SECRET_KEY,
    ADMIN_EMAIL
  } = process.env;

  if (
    !SUPABASE_URL ||
    !SUPABASE_PUBLISHABLE_KEY ||
    !SUPABASE_SECRET_KEY ||
    !ADMIN_EMAIL
  ) {
    console.error("Admin API configuration is incomplete.");
    return sendError(res, 500, "Server configuration is incomplete.");
  }

  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!token) {
    return sendError(res, 401, "Authentication required.");
  }

  const authClient = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );

  let user;

  try {
    const { data, error } = await authClient.auth.getUser(token);

    if (error || !data?.user) {
      return sendError(res, 401, "Your session is invalid or expired.");
    }

    user = data.user;
  } catch (error) {
    console.error("Authentication verification failed.");
    return sendError(res, 401, "Could not verify your session.");
  }

  if (
    !user.email ||
    user.email.toLowerCase() !== ADMIN_EMAIL.trim().toLowerCase()
  ) {
    return sendError(res, 403, "You are not authorised to manage this site.");
  }

  const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

  try {
    if (req.method === "GET") {
      const { data, error } = await db
        .from("site_content")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Content listing failed:", error.message);
        return sendError(res, 500, "Could not load website content.");
      }

      return res.status(200).json({ content: data || [] });
    }

    if (req.method === "POST") {
      const body = req.body || {};

      const title =
        typeof body.title === "string" ? body.title.trim() : "";
      const type =
        typeof body.type === "string" ? body.type.trim() : "";
      const slug =
        typeof body.slug === "string" ? body.slug.trim() : "";

      if (!title || !type || !slug) {
        return sendError(res, 400, "Title, type and slug are required.");
      }

      if (!ALLOWED_TYPES.includes(type)) {
        return sendError(res, 400, "Invalid content type.");
      }

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return sendError(
          res,
          400,
          "Slug must contain lowercase letters, numbers and single hyphens."
        );
      }

      const record = {};

      for (const field of EDITABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          record[field] = body[field];
        }
      }

      record.title = title;
      record.type = type;
      record.slug = slug;
      record.status = record.status || "draft";

      if (!ALLOWED_STATUSES.includes(record.status)) {
        return sendError(res, 400, "Invalid content status.");
      }

      if (record.featured !== undefined &&
          typeof record.featured !== "boolean") {
        return sendError(res, 400, "Featured must be true or false.");
      }

      if (record.sort_order !== undefined &&
          (!Number.isInteger(record.sort_order) || record.sort_order < 0)) {
        return sendError(res, 400, "Sort order must be a non-negative integer.");
      }

      record.published_at =
        record.status === "published" ? new Date().toISOString() : null;
      record.updated_at = new Date().toISOString();

      const { data, error } = await db
        .from("site_content")
        .insert(record)
        .select("*")
        .single();

      if (error) {
        if (error.code === "23505") {
          return sendError(res, 409, "That slug is already in use.");
        }
        console.error("Content creation failed:", error.message);
        return sendError(res, 500, "Could not create content.");
      }

      return res.status(201).json({ content: data });
    }

    const id =
      typeof req.query?.id === "string" ? req.query.id : "";

    if (!id) {
      return sendError(res, 400, "A content ID is required in the URL.");
    }

    if (req.method === "PATCH") {
      const body = req.body || {};
      const updates = {};

      for (const field of EDITABLE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(body, field)) {
          updates[field] = body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return sendError(res, 400, "No editable fields were supplied.");
      }

      if (updates.title !== undefined &&
          (typeof updates.title !== "string" || !updates.title.trim())) {
        return sendError(res, 400, "Title cannot be empty.");
      }

      if (updates.type !== undefined &&
          !ALLOWED_TYPES.includes(updates.type)) {
        return sendError(res, 400, "Invalid content type.");
      }

      if (updates.slug !== undefined &&
          (typeof updates.slug !== "string" ||
           !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(updates.slug))) {
        return sendError(res, 400, "Invalid slug format.");
      }

      if (updates.status !== undefined &&
          !ALLOWED_STATUSES.includes(updates.status)) {
        return sendError(res, 400, "Invalid content status.");
      }

      if (updates.featured !== undefined &&
          typeof updates.featured !== "boolean") {
        return sendError(res, 400, "Featured must be true or false.");
      }

      if (updates.sort_order !== undefined &&
          (!Number.isInteger(updates.sort_order) || updates.sort_order < 0)) {
        return sendError(res, 400, "Sort order must be a non-negative integer.");
      }

      if (updates.status === "published") {
        updates.published_at = new Date().toISOString();
      } else if (updates.status === "draft") {
        updates.published_at = null;
      }

      updates.updated_at = new Date().toISOString();

      const { data, error } = await db
        .from("site_content")
        .update(updates)
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (error) {
        if (error.code === "23505") {
          return sendError(res, 409, "That slug is already in use.");
        }
        console.error("Content update failed:", error.message);
        return sendError(res, 500, "Could not update content.");
      }

      if (!data) {
        return sendError(res, 404, "Content not found.");
      }

      return res.status(200).json({ content: data });
    }

    if (req.method === "DELETE") {
      const { data, error } = await db
        .from("site_content")
        .delete()
        .eq("id", id)
        .select("id")
        .maybeSingle();

      if (error) {
        console.error("Content deletion failed:", error.message);
        return sendError(res, 500, "Could not delete content.");
      }

      if (!data) {
        return sendError(res, 404, "Content not found.");
      }

      return res.status(200).json({
        success: true,
        deletedId: data.id
      });
    }
  } catch (error) {
    console.error("Admin API request failed:", error.message);
    return sendError(res, 500, "An unexpected server error occurred.");
  }
};
