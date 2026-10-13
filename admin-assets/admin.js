
document.addEventListener("DOMContentLoaded", async () => {
  const setupScreen = document.getElementById("setup-screen");
  const loginScreen = document.getElementById("login-screen");
  const app = document.getElementById("app");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const logoutButton = document.getElementById("logout-btn");

  
const TYPES = [
  "project",
  "article",
  "book",
  "poem",
  "ghazal",
  "nazm",
  "naat",
  "manqabat",
  "salam",
  "sher",
  "experience",
  "skill",
  "award",
  "heritage"
];

  let editingId = null;
  let contentRecords = [];
  let requestNumber = 0;

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  function showLoginError(message) {
    if (loginError) loginError.textContent = message || "";
  }

  if (
    !window.ADMIN_CONFIG?.supabaseUrl ||
    !window.ADMIN_CONFIG?.supabaseAnonKey ||
    !window.supabase
  ) {
    setupScreen?.classList.remove("hidden");
    loginScreen?.classList.add("hidden");
    app?.classList.add("hidden");
    return;
  }

  const client = window.supabase.createClient(
    window.ADMIN_CONFIG.supabaseUrl,
    window.ADMIN_CONFIG.supabaseAnonKey
  );

  async function apiRequest(method, body, id) {
    const { data, error } = await client.auth.getSession();

    if (error || !data.session?.access_token) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    let url = "/api/admin";
    if (id) url += "?id=" + encodeURIComponent(id);

    const options = {
      method,
      headers: {
        "Authorization": "Bearer " + data.session.access_token
      }
    };

    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
      await client.auth.signOut();
      throw new Error("Session expired. Please sign in again.");
    }

    if (!response.ok) {
      throw new Error(result.error || "The request failed.");
    }

    return result;
  }

  function ensureContentInterface() {
    if (document.getElementById("content-manager")) return;

    const section = document.createElement("section");
    section.id = "content-manager";
    section.className = "admin-card";

    section.innerHTML = `
      <style>
        #content-manager { margin-top: 22px; }
        #content-manager * { box-sizing: border-box; }
        #content-manager .cm-toolbar {
          display:flex; gap:12px; flex-wrap:wrap;
          align-items:center; justify-content:space-between;
        }
        #content-manager .cm-form {
          display:grid; grid-template-columns:repeat(2,minmax(0,1fr));
          gap:14px; margin-top:18px;
        }
        #content-manager .cm-field {
          display:flex; flex-direction:column; gap:6px; min-width:0;
        }
        #content-manager .cm-wide { grid-column:1 / -1; }
        #content-manager input, #content-manager select,
        #content-manager textarea {
          width:100%; max-width:100%; padding:11px;
          border:1px solid var(--admin-border,#d8d8d8);
          border-radius:8px; font:inherit;
        }
        #content-manager textarea { min-height:120px; resize:vertical; }
        #content-manager .cm-list {
          display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
          gap:14px; margin-top:20px;
        }
        #content-manager .cm-item {
          border:1px solid var(--admin-border,#ddd); border-radius:10px;
          padding:15px; min-width:0;
        }
        #content-manager .cm-item h3 { overflow-wrap:anywhere; }
        #content-manager .cm-muted {
          color:var(--admin-muted,#777); font-size:14px; line-height:1.6;
        }
        #content-manager .cm-actions {
          display:flex; flex-wrap:wrap; gap:8px; margin-top:12px;
        }
        #content-manager button { cursor:pointer; }
        #content-manager .cm-actions button,
        #content-manager .cm-toolbar button,
        #content-manager .cm-form button {
          width:auto; margin:0; padding:9px 13px;
        }
        #content-manager .cm-status {
          display:inline-block; padding:3px 8px; border-radius:20px;
          font-size:12px; border:1px solid currentColor;
        }
        #content-manager .cm-notice { margin:12px 0; line-height:1.6; }
        #content-manager .cm-danger { border:1px solid #b33; }
        #content-manager .cm-check {
          display:flex; align-items:center; gap:9px;
        }
        #content-manager .cm-check input { width:auto; }
        @media(max-width:600px) {
          #content-manager .cm-form { grid-template-columns:1fr; }
          #content-manager .cm-wide { grid-column:auto; }
          #content-manager .cm-actions button { flex:1; }
        }
      </style>

      <div class="cm-toolbar">
        <div>
          <h2>Content Manager</h2>
          <p class="admin-note">
            Create, edit, publish and manage your website records.
          </p>
        </div>
        <button id="cm-new" type="button">+ New content</button>
      </div>

      <p id="cm-notice" class="cm-notice" role="status" aria-live="polite"></p>

      <form id="cm-form" class="cm-form" hidden>
        <h2 class="cm-wide" id="cm-form-heading">Create content</h2>

        <label class="cm-field">
          Title *
          <input id="cm-title" maxlength="250" required>
        </label>

        <label class="cm-field">
          Content type *
          <select id="cm-type" required>
            ${TYPES.map(t =>
              `<option value="${t}">${t[0].toUpperCase() + t.slice(1)}</option>`
            ).join("")}
          </select>
        </label>

        <label class="cm-field cm-wide">
          URL slug *
          <input id="cm-slug" placeholder="example-article"
            pattern="[a-z0-9]+(-[a-z0-9]+)*" required>
          <span class="cm-muted">
            Lowercase letters, numbers and hyphens only.
          </span>
        </label>

        <label class="cm-field">
          Category
          <input id="cm-category" maxlength="150">
        </label>

        <label class="cm-field">
          Status
          <select id="cm-status">
            <option value="draft">Draft — not published</option>
            <option value="published">Published</option>
          </select>
        </label>

        <label class="cm-field cm-wide">
          Short summary
          <textarea id="cm-summary" rows="3"></textarea>
        </label>

        <label class="cm-field cm-wide">
          Full content
          <textarea id="cm-body" rows="10"
  placeholder="Write the article, biography, poem or record here..."></textarea>
</label>


<div class="cm-wide poetry-studio">
  <h3>Poetry Studio — Multilingual Text</h3>
  <p class="cm-muted">
    Add your poetry in any or all available scripts.
    Preserve line breaks when entering your verses.
  </p>

  <label class="cm-field">
    Poem form
    <input id="cm-poem-type"
      placeholder="Ghazal, Nazm, Naat, Sher...">
  </label>

  <label class="cm-field">
    Primary language
    
<select id="cm-language-primary">
  <option value="">Not specified</option>
  <option value="urdu">Urdu</option>
  <option value="roman">Roman Urdu</option>
  <option value="hindi">Hindi</option>
</select>

  </label>

  <label class="cm-field">
    Poet name
    <input id="cm-poet-name"
      placeholder="Syed Amjad Hussain">
  </label>

  <label class="cm-field">
    Takhallus
    <input id="cm-takhallus"
      placeholder="Amjad / امجدؔ">
  </label>

  <label class="cm-field">
    Radeef
    <input id="cm-radeef">
  </label>

  <label class="cm-field">
    Qaafiya
    <input id="cm-qaafiya">
  </label>

  <label class="cm-field">
    Beher / metre
    <input id="cm-beher">
  </label>

  <label class="cm-field cm-wide">
    Urdu — اردو
    <textarea id="cm-text-urdu"
      dir="rtl" lang="ur" rows="7"></textarea>
  </label>

  <label class="cm-field cm-wide">
    Roman Urdu / Hinglish
    <textarea id="cm-text-roman" rows="7"></textarea>
  </label>

  <label class="cm-field cm-wide">
    Hindi — देवनागरी
    <textarea id="cm-text-hindi"
      lang="hi" rows="7"></textarea>
  </label>

  <label class="cm-field cm-wide">
    Poetry notes and islah
    <textarea id="cm-poetry-notes" rows="4"></textarea>
  </label>
</div>


<label class="cm-field cm-wide">
  Image URL (optional)
          <input id="cm-image" type="url" placeholder="https://...">
        </label>

        <label class="cm-field">
          SEO title (optional)
          <input id="cm-seo-title" maxlength="250">
        </label>

        <label class="cm-field">
          Display order
          <input id="cm-sort" type="number" min="0" step="1" value="0">
        </label>

        <label class="cm-field cm-wide">
          SEO description (optional)
          <textarea id="cm-seo-description" rows="2"></textarea>
        </label>

        <label class="cm-check cm-wide">
          <input id="cm-featured" type="checkbox">
          Feature this record
        </label>

        <div class="cm-actions cm-wide">
          <button id="cm-save" type="submit">Save content</button>
          <button id="cm-cancel" type="button">Cancel</button>
        </div>
      </form>

      <hr style="margin:24px 0; opacity:.25">

      <div class="cm-toolbar">
        <h2>Saved content</h2>
        <button id="cm-refresh" type="button">Refresh list</button>
      </div>

      <p id="cm-count" class="cm-muted">Loading content...</p>
      <div id="cm-list" class="cm-list"></div>
    `;

    app.appendChild(section);

    const form = section.querySelector("#cm-form");

    section.querySelector("#cm-new").addEventListener("click", () => {
      resetForm();
      form.hidden = false;
      section.querySelector("#cm-title").focus();
    });

    section.querySelector("#cm-cancel").addEventListener("click", resetForm);

    section.querySelector("#cm-refresh").addEventListener("click", loadContent);

    section.querySelector("#cm-title").addEventListener("input", () => {
      if (!editingId) {
        section.querySelector("#cm-slug").value =
          makeSlug(section.querySelector("#cm-title").value);
      }
    });

    form.addEventListener("submit", saveContent);
    section.querySelector("#cm-list").addEventListener("click", handleListAction);
  }

  function makeSlug(text) {
    return text
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 180);
  }

  function notice(message, isError = false) {
    const el = document.getElementById("cm-notice");
    if (!el) return;
    el.textContent = message;
    el.style.color = isError ? "#b42318" : "";
  }

  function resetForm() {
    const form = document.getElementById("cm-form");
    if (!form) return;

    editingId = null;
    form.reset();
    form.hidden = true;
    document.getElementById("cm-sort").value = "0";
    document.getElementById("cm-form-heading").textContent = "Create content";
    document.getElementById("cm-save").textContent = "Save content";
    notice("");
  }

  async function loadContent() {
    const thisRequest = ++requestNumber;
    const list = document.getElementById("cm-list");
    const count = document.getElementById("cm-count");

    if (!list || !count) return;

    list.innerHTML = "";
    count.textContent = "Loading content...";
    notice("");

    try {
      const result = await apiRequest("GET");

      if (thisRequest !== requestNumber) return;

      contentRecords = Array.isArray(result.content) ? result.content : [];
      count.textContent = `${contentRecords.length} record(s) found.`;

      if (!contentRecords.length) {
        list.innerHTML =
          '<p class="cm-muted">No records yet. Click “New content” to create your first one.</p>';
        return;
      }

      list.innerHTML = contentRecords.map(record => `
        <article class="cm-item">
          <span class="cm-status">${escapeHTML(record.status)}</span>
          <h3>${escapeHTML(record.title)}</h3>
          <p class="cm-muted">
            ${escapeHTML(record.type)}${record.category ? " · " + escapeHTML(record.category) : ""}
          </p>
          <p class="cm-muted">${escapeHTML(record.summary || "No summary added.")}</p>
          <p class="cm-muted">Slug: ${escapeHTML(record.slug)}</p>
          <div class="cm-actions">
            <button type="button" data-action="edit"
              data-id="${escapeHTML(record.id)}">Edit</button>
            <button type="button" data-action="toggle"
              data-id="${escapeHTML(record.id)}">
              ${record.status === "published" ? "Unpublish" : "Publish"}
            </button>
            <button type="button" class="cm-danger"
              data-action="delete" data-id="${escapeHTML(record.id)}">Delete</button>
          </div>
        </article>
      `).join("");
    } catch (error) {
      count.textContent = "Could not load content.";
      notice(error.message, true);
    }
  }

  function editContent(id) {
    const record = contentRecords.find(item => item.id === id);
    if (!record) return;

    editingId = id;

    document.getElementById("cm-title").value = record.title || "";
    document.getElementById("cm-type").value = record.type || "article";
    document.getElementById("cm-slug").value = record.slug || "";
    document.getElementById("cm-category").value = record.category || "";
    document.getElementById("cm-status").value = record.status || "draft";
    document.getElementById("cm-summary").value = record.summary || "";
    document.getElementById("cm-body").value = record.body || "";
    document.getElementById("cm-image").value = record.image_url || "";
    document.getElementById("cm-seo-title").value = record.seo_title || "";
    document.getElementById("cm-seo-description").value =
      record.seo_description || "";
    document.getElementById("cm-sort").value = record.sort_order ?? 0;
    document.getElementById("cm-featured").checked = !!record.featured;

    document.getElementById("cm-form-heading").textContent = "Edit content";
    document.getElementById("cm-save").textContent = "Update content";
    document.getElementById("cm-form").hidden = false;
    document.getElementById("cm-form").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  async function saveContent(event) {
    event.preventDefault();

    const saveButton = document.getElementById("cm-save");
    const title = document.getElementById("cm-title").value.trim();
    const type = document.getElementById("cm-type").value;
    const slug = document.getElementById("cm-slug").value.trim();

    if (!title || !type || !slug) {
      notice("Please complete the title, content type and slug.", true);
      return;
    }

    const sortOrder = Number(document.getElementById("cm-sort").value);

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      notice("Display order must be a non-negative whole number.", true);
      return;
    }

    const image = document.getElementById("cm-image").value.trim();

    if (image) {
      try {
        const parsed = new URL(image);
        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new Error();
        }
      } catch {
        notice("Please enter a valid image URL beginning with https:// or http://.", true);
        return;
      }
    }

    
const payload = {
  title,
  type,
  slug,

  category: document.getElementById("cm-category").value.trim(),
  status: document.getElementById("cm-status").value,
  summary: document.getElementById("cm-summary").value.trim(),
  body: document.getElementById("cm-body").value,

  image_url: image || null,
  seo_title: document.getElementById("cm-seo-title").value.trim(),
  seo_description: document.getElementById("cm-seo-description").value.trim(),

  sort_order: sortOrder,
  featured: document.getElementById("cm-featured").checked,

  // Poetry Studio fields
  poem_type: document.getElementById("cm-poem-type").value.trim(),
  language_primary: document.getElementById("cm-language-primary").value,
  poet_name: document.getElementById("cm-poet-name").value.trim(),
  takhallus: document.getElementById("cm-takhallus").value.trim(),
  radeef: document.getElementById("cm-radeef").value.trim(),
  qaafiya: document.getElementById("cm-qaafiya").value.trim(),
  beher: document.getElementById("cm-beher").value.trim(),

  text_urdu: document.getElementById("cm-text-urdu").value,
  text_roman: document.getElementById("cm-text-roman").value,
  text_hindi: document.getElementById("cm-text-hindi").value,
  poetry_notes: document.getElementById("cm-poetry-notes").value
};

    saveButton.disabled = true;
    notice(editingId ? "Updating content..." : "Saving content...");

    try {
      await apiRequest(editingId ? "PATCH" : "POST", payload, editingId || undefined);
      notice(editingId ? "Content updated successfully." : "Content created successfully.");
      resetForm();
      await loadContent();
      notice("Saved successfully.");
    } catch (error) {
      notice(error.message, true);
    } finally {
      saveButton.disabled = false;
    }
  }

  async function handleListAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;
    const record = contentRecords.find(item => item.id === id);

    if (!record) return;

    if (action === "edit") {
      editContent(id);
      return;
    }

    if (action === "toggle") {
      const newStatus = record.status === "published" ? "draft" : "published";
      const message = newStatus === "published"
        ? `Publish "${record.title}"?`
        : `Unpublish "${record.title}"?`;

      if (!confirm(message)) return;

      button.disabled = true;

      try {
        await apiRequest("PATCH", { status: newStatus }, id);
        notice(`Content is now ${newStatus}.`);
        await loadContent();
      } catch (error) {
        notice(error.message, true);
      } finally {
        button.disabled = false;
      }
      return;
    }

    if (action === "delete") {
      if (!confirm(
        `Permanently delete "${record.title}"? This cannot be undone.`
      )) return;

      button.disabled = true;

      try {
        await apiRequest("DELETE", undefined, id);

        if (editingId === id) resetForm();

        notice("Content deleted.");
        await loadContent();
      } catch (error) {
        notice(error.message, true);
      } finally {
        button.disabled = false;
      }
    }
  }

  async function showLogin() {
    app?.classList.add("hidden");
    setupScreen?.classList.add("hidden");
    loginScreen?.classList.remove("hidden");
  }

  async function showDashboard(user) {
    loginScreen?.classList.add("hidden");
    setupScreen?.classList.add("hidden");
    app?.classList.remove("hidden");

    const emailLabel = document.getElementById("admin-email");
    if (emailLabel) emailLabel.textContent = user.email || "Signed in";

    showLoginError("");
    ensureContentInterface();
    await loadContent();
  }

  async function checkSession() {
    const { data, error } = await client.auth.getSession();

    if (error || !data.session) {
      await showLogin();
      return;
    }

    await showDashboard(data.session.user);
  }

  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    showLoginError("");

    const email = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value;
    const submitButton = loginForm.querySelector('button[type="submit"]');

    if (!email || !password) {
      showLoginError("Enter your email address and password.");
      return;
    }

    if (submitButton) submitButton.disabled = true;
    showLoginError("Signing in…");

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      showLoginError("");
      await showDashboard(data.user);
    } catch (error) {
      showLoginError(error.message || "Sign-in failed.");
    } finally {
      if (submitButton) submitButton.disabled = false;
    }
  });

  logoutButton?.addEventListener("click", async () => {
    await client.auth.signOut();
    await showLogin();
  });

  client.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      showLogin();
    }
  });

  await checkSession();
});
