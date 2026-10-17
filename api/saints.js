const { createClient } = require("@supabase/supabase-js");

const API_BASE = "https://api.github.com";
const MAX_CONTENT_LENGTH = 1_000_000;

function sendError(res, status, error) {
  return res.status(status).json({ error });
}

function validFileName(name) {
  return (
    typeof name === "string" &&
    /^[a-z0-9]+(?:-[a-z0-9]+)*\.html$/.test(name)
  );
}

function encodeBase64(text) {
  return Buffer.from(text, "utf8").toString("base64");
}

function decodeBase64(text) {
  return Buffer.from(
    String(text || "").replace(/\n/g, ""),
    "base64"
  ).toString("utf8");
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  if (!["GET", "PUT", "POST"].includes(req.method)) {
    res.setHeader("Allow", "GET, PUT, POST");
    return sendError(res, 405, "Method not allowed.");
  }

  const {
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    ADMIN_EMAIL,
    GITHUB_TOKEN,
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_BRANCH
  } = process.env;

  if (
    !SUPABASE_URL ||
    !SUPABASE_PUBLISHABLE_KEY ||
    !ADMIN_EMAIL ||
    !GITHUB_TOKEN ||
    !GITHUB_OWNER ||
    !GITHUB_REPO
  ) {
    return sendError(
      res,
      500,
      "Server configuration is incomplete. Configure the Bio of Sufis environment variables in Vercel."
    );
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
      return sendError(
        res,
        401,
        "Your session is invalid or expired."
      );
    }

    user = data.user;
  } catch (_) {
    return sendError(
      res,
      401,
      "Could not verify your session."
    );
  }

  const allowedEmails = ADMIN_EMAIL
    .split(",")
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);

  if (
    !user.email ||
    !allowedEmails.includes(user.email.toLowerCase())
  ) {
    return sendError(
      res,
      403,
      "You are not authorised to manage this site."
    );
  }

  const owner = GITHUB_OWNER;
  const repo = GITHUB_REPO;
  const branch = GITHUB_BRANCH || "main";

  const basePath =
    `repos/${encodeURIComponent(owner)}/` +
    `${encodeURIComponent(repo)}/contents/saints`;

  async function github(path, options = {}) {
    const response = await fetch(`${API_BASE}/${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const status =
        response.status === 404 ? 404 :
        response.status === 409 ? 409 : 502;

      const message =
        response.status === 404
          ? "File or repository not found. Check GitHub owner, repository, branch, and permissions."
          : response.status === 409
          ? "GitHub reports a conflict. Refresh the page and try again."
          : "GitHub request failed. Check the server-side GitHub token and repository permissions.";

      const err = new Error(message);
      err.status = status;
      throw err;
    }

    return payload;
  }

  try {
    if (req.method === "GET") {
      const fileName =
        typeof req.query?.file === "string"
          ? req.query.file
          : "";

      if (!fileName) {
        const files = await github(
          `${basePath}?ref=${encodeURIComponent(branch)}`
        );

        return res.status(200).json({
          files: (Array.isArray(files) ? files : [])
            .filter(
              f => f.type === "file" && f.name.endsWith(".html")
            )
            .map(f => ({
              name: f.name,
              sha: f.sha,
              size: f.size,
              html_url: f.html_url
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
        });
      }

      if (!validFileName(fileName)) {
        return sendError(res, 400, "Invalid HTML file name.");
      }

      const file = await github(
        `${basePath}/${encodeURIComponent(fileName)}` +
        `?ref=${encodeURIComponent(branch)}`
      );

      return res.status(200).json({
        name: file.name,
        sha: file.sha,
        content: decodeBase64(file.content),
        html_url: file.html_url
      });
    }

    const body = req.body || {};
    const fileName = body.fileName;
    const content = body.content;

    if (!validFileName(fileName)) {
      return sendError(
        res,
        400,
        "File name must use lowercase letters, numbers, and hyphens and end in .html."
      );
    }

    if (typeof content !== "string" || !content.trim()) {
      return sendError(
        res,
        400,
        "HTML content cannot be empty."
      );
    }

    if (content.length > MAX_CONTENT_LENGTH) {
      return sendError(
        res,
        413,
        "HTML content is too large (maximum 1 MB)."
      );
    }

    const filePath =
      `${basePath}/${encodeURIComponent(fileName)}`;

    if (req.method === "PUT") {
      const current = await github(
        `${filePath}?ref=${encodeURIComponent(branch)}`
      );

      if (body.sha && body.sha !== current.sha) {
        return sendError(
          res,
          409,
          "This page changed on GitHub since it was loaded. Reload it before saving to avoid overwriting newer changes."
        );
      }

      const result = await github(filePath, {
        method: "PUT",
        body: JSON.stringify({
          message: `Update saints/${fileName} via admin panel`,
          content: encodeBase64(content),
          sha: current.sha,
          branch
        })
      });

      return res.status(200).json({
        name: fileName,
        sha: result.content?.sha,
        commit: result.commit?.html_url
      });
    }

    // POST creates a new page only.
    // It will not overwrite an existing file.
    const result = await github(filePath, {
      method: "PUT",
      body: JSON.stringify({
        message: `Add saints/${fileName} via admin panel`,
        content: encodeBase64(content),
        branch
      })
    });

    return res.status(201).json({
      name: fileName,
      sha: result.content?.sha,
      commit: result.commit?.html_url
    });
  } catch (error) {
    if (error.status === 404 && req.method === "POST") {
      return sendError(
        res,
        409,
        "That file may already exist. Refresh the list and choose a different name."
      );
    }

    return sendError(
      res,
      error.status || 502,
      error.message || "The Bio of Sufis request failed."
    );
  }
};
