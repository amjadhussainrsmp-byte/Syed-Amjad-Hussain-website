/* Syed Amjad Hussain — Admin Panel
 * File: admin-assets/admin.js
 * Uses the existing Supabase sign-in and /api/admin endpoint.
 * Content-specific metadata fields require matching API/schema support.
 */
document.addEventListener("DOMContentLoaded", async () => {
  "use strict";

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const setupScreen = $("#setup-screen");
  const loginScreen = $("#login-screen");
  const app = $("#app");
  const loginForm = $("#login-form");
  const loginError = $("#login-error");
  const logoutButton = $("#logout-btn");

  const TYPES = [
    "ghazal", "naat", "manqabat", "salam", "sher", "poem", "nazm",
    "award", "book", "article", "heritage", "project", "experience", "skill"
  ];

  const WORKSPACES = {
    poetry: {
      label: "Poetry Studio",
      heading: "Add literary work",
      type: "ghazal",
      description: "Create a ghazal, naat, manqabat, bait, or salam in Urdu, Hindi and Roman Urdu."
    },
    sher: {
      label: "Sher Collection",
      heading: "Add a sher",
      type: "sher",
      description: "Enter the couplet in Urdu, Hindi and Roman Urdu."
    },
    award: {
      label: "Awards & Honours",
      heading: "Add an award",
      type: "award",
      description: "Record the award title, organisation, year and supporting details."
    },
    book: {
      label: "Books",
      heading: "Add a book",
      type: "book",
      description: "Record publication details for the Books & Articles page."
    },
    article: {
      label: "Articles",
      heading: "Add an article",
      type: "article",
      description: "Prepare an article, essay, interview or published contribution."
    },
    heritage: {
      label: "Sufi Heritage",
      heading: "Add a saint or heritage entry",
      type: "heritage",
      description: "Add a saint summary and the URL of the full profile page."
    },
    all: {
      label: "All Content",
      heading: "Create content",
      type: "article",
      description: "Manage all records stored in the website content database."
    }
  };

  let editingId = null;
  let contentRecords = [];
  let activeWorkspace = "all";
  let requestNumber = 0;

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
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

    const url = "/api/admin" + (id ? "?id=" + encodeURIComponent(id) : "");
    const options = {
      method,
      headers: {
        Authorization: "Bearer " + data.session.access_token
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

  function field(id, label, opts = {}) {
    const {
      type = "text", placeholder = "", wide = false, rows = 3,
      value = "", required = false, maxlength = 250, dir = "", lang = "",
      help = "", options = null
    } = opts;

    const cls = "cm-field" + (wide ? " cm-wide" : "");
    let control;

    if (options) {
      control = `<select id="${id}" ${required ? "required" : ""}>${
        options.map(o =>
          `<option value="${escapeHTML(o.value)}">${escapeHTML(o.label)}</option>`
        ).join("")
      }</select>`;
    } else if (type === "textarea") {
      control = `<textarea id="${id}" rows="${rows}" placeholder="${escapeHTML(placeholder)}"
        ${dir ? `dir="${dir}"` : ""} ${lang ? `lang="${lang}"` : ""}
        ${required ? "required" : ""}>${escapeHTML(value)}</textarea>`;
    } else {
      control = `<input id="${id}" type="${type}" value="${escapeHTML(value)}"
        placeholder="${escapeHTML(placeholder)}"
        ${maxlength ? `maxlength="${maxlength}"` : ""}
        ${required ? "required" : ""}>`;
    }

    return `<label class="${cls}">
      <span>${label}${required ? " *" : ""}</span>
      ${control}
      ${help ? `<small class="cm-muted">${help}</small>` : ""}
    </label>`;
  }

  

function ensureContentInterface() {
    let section = $("#content-manager");

    // Reuse the existing placeholder.
    if (section && section.dataset.initialized === "true") {
      bindWorkspaceButtons();
      return;
    }

    // Create the container only if it doesn't exist.
    if (!section) {
      section = document.createElement("section");
      section.id = "content-manager";
      app?.appendChild(section);
    }

    section.classList.add("admin-card");
    section.dataset.initialized = "true";

    section.innerHTML = `

      <style>
        #content-manager{margin-top:24px;color:var(--admin-text,#30272a)}
        #content-manager *{box-sizing:border-box}
        #content-manager .cm-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        #content-manager .cm-toolbar h2,#content-manager h2{margin:0}
        #content-manager .cm-muted{color:var(--admin-muted,#766a6b);font-size:13px;line-height:1.65}
        #content-manager .cm-notice{min-height:1.4em;margin:12px 0;line-height:1.6}
        #content-manager .cm-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;margin-top:20px}
        #content-manager .cm-field{display:flex;flex-direction:column;gap:7px;min-width:0;font-weight:600;font-size:13px}
        #content-manager .cm-field input,#content-manager .cm-field select,#content-manager .cm-field textarea{width:100%;max-width:100%;padding:12px;border:1px solid var(--admin-border,#d9cfd0);border-radius:9px;background:var(--admin-input,#fffdf9);color:inherit;font:inherit;font-weight:400}
        #content-manager .cm-field textarea{min-height:95px;resize:vertical;line-height:1.7}
        #content-manager .cm-field textarea[dir=rtl]{text-align:right;font-size:17px}
        #content-manager .cm-wide{grid-column:1/-1}
        #content-manager .cm-group{grid-column:1/-1;border:1px solid var(--admin-border,#e2d6d3);border-radius:12px;padding:16px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
        #content-manager .cm-group h3,#content-manager .cm-group p{grid-column:1/-1;margin:0}
        #content-manager .cm-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
        #content-manager button{cursor:pointer}
        #content-manager .cm-actions button,#content-manager .cm-toolbar button{padding:10px 14px;width:auto;margin:0}
        #content-manager .cm-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(245px,1fr));gap:13px;margin-top:16px}
        #content-manager .cm-item{min-width:0;border:1px solid var(--admin-border,#e2d6d3);border-radius:12px;padding:15px;background:var(--admin-card,#fffdf9)}
        #content-manager .cm-item h3{margin:10px 0 6px;overflow-wrap:anywhere;font-size:17px}
        #content-manager .cm-status{display:inline-block;border:1px solid currentColor;border-radius:30px;padding:3px 8px;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
        #content-manager .cm-danger{border:1px solid #b42318!important}
        #content-manager .cm-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0}
        #content-manager .cm-tabs button{border:1px solid var(--admin-border,#d9cfd0);border-radius:30px;padding:8px 12px;background:transparent;color:inherit}
        #content-manager .cm-tabs button[aria-pressed=true]{background:var(--admin-accent,#652e36);border-color:var(--admin-accent,#652e36);color:#fff}
        #content-manager .cm-workspace-intro{padding:15px;border-radius:10px;background:var(--admin-soft,#f7efe8);margin:14px 0}
        #content-manager .cm-workspace-intro p{margin:5px 0 0}
        #content-manager .cm-divider{border:0;border-top:1px solid var(--admin-border,#e2d6d3);margin:24px 0}
        @media(max-width:640px){#content-manager .cm-form,#content-manager .cm-group{grid-template-columns:1fr}#content-manager .cm-wide,#content-manager .cm-group h3,#content-manager .cm-group p{grid-column:auto}#content-manager .cm-actions button{flex:1}}
      </style>

      <div class="cm-toolbar">
        <div>
          <h2>Content Studio</h2>
          <p class="cm-muted">One secure workspace for your website's editorial content.</p>
        </div>
        <button id="cm-refresh" type="button">↻ Refresh records</button>
      </div>

      <div class="cm-tabs" id="cm-tabs" aria-label="Content workspaces">
        ${Object.entries(WORKSPACES).map(([key, ws]) =>
          `<button type="button" data-workspace="${key}" aria-pressed="${key === "all"}">${escapeHTML(ws.label)}</button>`
        ).join("")}
      </div>

      <div class="cm-workspace-intro">
        <strong id="cm-workspace-heading">Create content</strong>
        <p id="cm-workspace-description" class="cm-muted">Manage all records stored in the website content database.</p>
      </div>

      <p id="cm-notice" class="cm-notice" role="status" aria-live="polite"></p>

      <form id="cm-form" class="cm-form" hidden>
        <h2 class="cm-wide" id="cm-form-heading">Create content</h2>

        <div class="cm-group" id="cm-common-fields">
          <h3>Essential details</h3>
          ${field("cm-title", "Main title", {required:true})}
          ${field("cm-type", "Record type", {required:true,options:TYPES.map(t=>({value:t,label:t.charAt(0).toUpperCase()+t.slice(1)}))})}
          ${field("cm-slug", "URL slug", {required:true,placeholder:"example-title",wide:true,help:"Use lowercase English letters, numbers and single hyphens."})}
          ${field("cm-category", "Category", {placeholder:"e.g. Sufi Poetry"})}
          ${field("cm-status", "Publishing status", {options:[{value:"draft",label:"Draft — not public"},{value:"published",label:"Published"}]})}
          ${field("cm-summary", "Short summary / description", {type:"textarea",wide:true,rows:3})}
          ${field("cm-body", "Full text / article / biography", {type:"textarea",wide:true,rows:8,placeholder:"Enter the full content here..."})}
          ${field("cm-image", "Cover or image URL (optional)", {type:"url",wide:true,placeholder:"https://..."})}
          ${field("cm-sort", "Display order", {type:"number",value:"0"})}
          <label class="cm-field"><span>Featured record</span><span><input id="cm-featured" type="checkbox" style="width:auto"> Feature on site where supported</span></label>
          ${field("cm-seo-title", "SEO title", {maxlength:250})}
          ${field("cm-seo-description", "SEO description", {type:"textarea",rows:2})}
        </div>

        <div class="cm-group" id="cm-poetry-fields">
          <h3>Poetry Studio · multilingual text</h3>
          <p class="cm-muted">For Ghazal, Naat, Manqabat, Bait, Salam and Sher. Keep line breaks as you want them displayed.</p>
          ${field("cm-title-urdu", "Title in Urdu", {dir:"rtl",lang:"ur",placeholder:"عنوان"})}
          ${field("cm-title-hindi", "Title in Hindi", {lang:"hi",placeholder:"शीर्षक"})}
          ${field("cm-title-roman", "Title in Roman Urdu", {placeholder:"Title in Roman Urdu"})}
          ${field("cm-poem-type", "Poetry form", {options:["ghazal","naat","manqabat","bait","salam","sher","nazm","poem"].map(t=>({value:t,label:t.charAt(0).toUpperCase()+t.slice(1)}))})}
          ${field("cm-language-primary", "Primary language", {options:[{value:"urdu",label:"Urdu"},{value:"roman",label:"Roman Urdu"},{value:"hindi",label:"Hindi"}]})}
          ${field("cm-poet-name", "Poet name", {value:"Syed Amjad Hussain"})}
          ${field("cm-takhallus", "Takhallus", {placeholder:"Amjad / امجدؔ"})}
          ${field("cm-radeef", "Radeef")}
          ${field("cm-qaafiya", "Qaafiya")}
          ${field("cm-beher", "Beher / metre")}
          ${field("cm-text-urdu", "Full text · Urdu", {type:"textarea",wide:true,rows:7,dir:"rtl",lang:"ur"})}
          ${field("cm-text-hindi", "Full text · Hindi", {type:"textarea",wide:true,rows:7,lang:"hi"})}
          ${field("cm-text-roman", "Full text · Roman Urdu", {type:"textarea",wide:true,rows:7})}
          ${field("cm-poetry-notes", "Poetry notes / islah (optional)", {type:"textarea",wide:true,rows:3})}
        </div>

        <div class="cm-group" id="cm-award-fields">
          <h3>Award details</h3>
          ${field("cm-award-name", "Award name")}
          ${field("cm-award-year", "Year", {type:"number"})}
          ${field("cm-award-organisation", "Awarding organisation")}
          ${field("cm-award-location", "Venue / location")}
          ${field("cm-award-date", "Date received", {type:"date"})}
          ${field("cm-award-level", "Recognition level", {placeholder:"National / State / Institutional"})}
        </div>

        <div class="cm-group" id="cm-book-fields">
          <h3>Book details</h3>
          ${field("cm-book-author", "Author / editor")}
          ${field("cm-book-publisher", "Publisher")}
          ${field("cm-book-year", "Publication year", {type:"number"})}
          ${field("cm-book-isbn", "ISBN (optional)")}
          ${field("cm-book-pages", "Number of pages", {type:"number"})}
          ${field("cm-book-price", "Price (optional)", {placeholder:"₹329"})}
          ${field("cm-book-language", "Language")}
          ${field("cm-book-buy-url", "Purchase / book URL", {type:"url",wide:true,placeholder:"https://..."})}
        </div>

        <div class="cm-group" id="cm-article-fields">
          <h3>Article details</h3>
          ${field("cm-article-publication", "Publication / journal")}
          ${field("cm-article-date", "Publication date", {type:"date"})}
          ${field("cm-article-author", "Author byline")}
          ${field("cm-article-url", "Original article URL", {type:"url",wide:true,placeholder:"https://..."})}
        </div>

        <div class="cm-group" id="cm-heritage-fields">
          <h3>Saint / heritage profile</h3>
          ${field("cm-saint-name", "Saint's full name")}
          ${field("cm-saint-period", "Period / dates")}
          ${field("cm-saint-place", "Dargah / region")}
          ${field("cm-saint-profile-url", "Full profile page URL", {type:"url",wide:true,placeholder:"/saints/saint-name.html"})}
          ${field("cm-saint-lineage", "Sufi silsila / affiliation")}
          ${field("cm-saint-sources", "Sources / references", {type:"textarea",wide:true,rows:3})}
        </div>

        <div class="cm-actions cm-wide">
          <button id="cm-save" type="submit">Save record</button>
          <button id="cm-cancel" type="button">Cancel</button>
        </div>
      </form>

      <hr class="cm-divider">
      <div class="cm-toolbar">
        <h2>Saved records</h2>
        <span id="cm-count" class="cm-muted">Loading…</span>
      </div>
      <div id="cm-list" class="cm-list"></div>
    `;

    app?.appendChild(section);

    $("#cm-cancel", section)?.addEventListener("click", resetForm);
    $("#cm-refresh", section)?.addEventListener("click", loadContent);
    $("#cm-title", section)?.addEventListener("input", () => {
      if (!editingId) $("#cm-slug").value = makeSlug($("#cm-title").value);
    });
    $("#cm-type", section)?.addEventListener("change", updateFieldVisibility);
    $("#cm-form", section)?.addEventListener("submit", saveContent);
    $("#cm-list", section)?.addEventListener("click", handleListAction);

    bindWorkspaceButtons();
    updateFieldVisibility();
  }
  
  function bindWorkspaceButtons() {
    // Connect workspace shortcuts/cards already present in admin.html.
    $$("[data-workspace]").forEach(button => {
      if (button.dataset.workspaceBound === "true") return;
      button.dataset.workspaceBound = "true";

      button.addEventListener("click", event => {
        const key = button.dataset.workspace;
        if (!WORKSPACES[key]) return;

        event.preventDefault();
        selectWorkspace(key);
        $("#cm-form").hidden = true;
        $("#content-manager")?.scrollIntoView({
          behavior:"smooth",
          block:"start"
        });
      });
    });
  }

  function selectWorkspace(key) {
    activeWorkspace = WORKSPACES[key] ? key : "all";

    $$("#cm-tabs [data-workspace]").forEach(button => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.workspace === activeWorkspace)
      );
    });

    const ws = WORKSPACES[activeWorkspace];
    $("#cm-workspace-heading").textContent = ws.heading;
    $("#cm-workspace-description").textContent = ws.description;

    updateFieldVisibility();
    renderContentList();
  }

  function updateFieldVisibility() {
    const type = $("#cm-type")?.value ||
      WORKSPACES[activeWorkspace]?.type || "article";

    const isPoetry = [
      "ghazal","naat","manqabat","salam","sher","poem","nazm"
    ].includes(type);

    const show = (id, visible) => {
      const node = $(id);
      if (node) node.hidden = !visible;
    };

    show("#cm-poetry-fields", isPoetry);
    show("#cm-award-fields", type === "award");
    show("#cm-book-fields", type === "book");
    show("#cm-article-fields", type === "article");
    show("#cm-heritage-fields", type === "heritage");
  }

  function makeSlug(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 180);
  }

  function notice(message, isError = false) {
    const node = $("#cm-notice");
    if (!node) return;
    node.textContent = message || "";
    node.style.color = isError ? "#b42318" : "";
  }

  function val(id) {
    return $(id)?.value?.trim?.() ?? "";
  }

  function raw(id) {
    return $(id)?.value ?? "";
  }

  function set(id, value) {
    const node = $(id);
    if (node) node.value = value ?? "";
  }

  function openNewRecord() {
    resetForm(false);

    const preferred = WORKSPACES[activeWorkspace]?.type || "article";
    set("#cm-type", preferred);

    $("#cm-form").hidden = false;
    $("#cm-form-heading").textContent =
      WORKSPACES[activeWorkspace]?.heading || "Create content";
    $("#cm-save").textContent = "Save record";

    updateFieldVisibility();
    $("#cm-form").scrollIntoView({behavior:"smooth",block:"start"});
    $("#cm-title")?.focus();
  }

  function resetForm(hide = true) {
    const form = $("#cm-form");
    if (!form) return;

    editingId = null;
    form.reset();

    set("#cm-sort", "0");
    set("#cm-poet-name", "Syed Amjad Hussain");

    if (hide) form.hidden = true;

    $("#cm-form-heading").textContent = "Create content";
    $("#cm-save").textContent = "Save record";
    notice("");
    updateFieldVisibility();
  }

  function workspaceForType(type) {
    if ([
      "ghazal","naat","manqabat","salam","sher","poem","nazm"
    ].includes(type)) {
      return type === "sher" ? "sher" : "poetry";
    }

    if (type === "award") return "award";
    if (type === "book") return "book";
    if (type === "article") return "article";
    if (type === "heritage") return "heritage";

    return "all";
  }

  async function loadContent() {
    const thisRequest = ++requestNumber;
    const list = $("#cm-list");
    const count = $("#cm-count");

    if (!list || !count) return;

    list.innerHTML = "";
    count.textContent = "Loading records…";
    notice("");

    try {
      const result = await apiRequest("GET");
      if (thisRequest !== requestNumber) return;

      contentRecords = Array.isArray(result.content) ? result.content : [];
      renderContentList();
    } catch (error) {
      count.textContent = "Records could not be loaded.";
      notice(error.message, true);
    }
  }

  function renderContentList() {
    const list = $("#cm-list");
    const count = $("#cm-count");
    if (!list || !count) return;

    const accepted = activeWorkspace === "all"
      ? contentRecords
      : contentRecords.filter(
          record => workspaceForType(record.type) === activeWorkspace
        );

    count.textContent =
      `${accepted.length} record${accepted.length === 1 ? "" : "s"}`;

    if (!accepted.length) {
      list.innerHTML =
        `<p class="cm-muted">No records in this workspace yet. Use the form to add one.</p>`;
      return;
    }

    list.innerHTML = accepted.map(record => `
      <article class="cm-item">
        <span class="cm-status">${escapeHTML(record.status || "draft")}</span>
        <h3>${escapeHTML(record.title || "Untitled record")}</h3>
        <p class="cm-muted">${escapeHTML(record.type || "content")}${record.category ? " · " + escapeHTML(record.category) : ""}</p>
        <p class="cm-muted">${escapeHTML(record.summary || "No summary added.")}</p>
        <p class="cm-muted">Slug: ${escapeHTML(record.slug || "—")}</p>
        <div class="cm-actions">
          <button type="button" data-action="edit" data-id="${escapeHTML(record.id)}">Edit</button>
          <button type="button" data-action="toggle" data-id="${escapeHTML(record.id)}">${record.status === "published" ? "Unpublish" : "Publish"}</button>
          <button type="button" class="cm-danger" data-action="delete" data-id="${escapeHTML(record.id)}">Delete</button>
        </div>
      </article>
    `).join("");
  }

  function editContent(id) {
    const record = contentRecords.find(
      item => String(item.id) === String(id)
    );
    if (!record) return;

    editingId = id;

    const simpleFields = {
      "#cm-title":"title",
      "#cm-type":"type",
      "#cm-slug":"slug",
      "#cm-category":"category",
      "#cm-status":"status",
      "#cm-summary":"summary",
      "#cm-body":"body",
      "#cm-image":"image_url",
      "#cm-seo-title":"seo_title",
      "#cm-seo-description":"seo_description",
      "#cm-sort":"sort_order",
      "#cm-poem-type":"poem_type",
      "#cm-language-primary":"language_primary",
      "#cm-poet-name":"poet_name",
      "#cm-takhallus":"takhallus",
      "#cm-radeef":"radeef",
      "#cm-qaafiya":"qaafiya",
      "#cm-beher":"beher",
      "#cm-text-urdu":"text_urdu",
      "#cm-text-roman":"text_roman",
      "#cm-text-hindi":"text_hindi",
      "#cm-poetry-notes":"poetry_notes"
    };

    Object.entries(simpleFields).forEach(([selector, key]) => {
      set(selector, record[key]);
    });

    $("#cm-featured").checked = !!record.featured;

    const metadataFields = {
      "#cm-title-urdu":"title_urdu",
      "#cm-title-hindi":"title_hindi",
      "#cm-title-roman":"title_roman",
      "#cm-award-name":"award_name",
      "#cm-award-year":"award_year",
      "#cm-award-organisation":"award_organisation",
      "#cm-award-location":"award_location",
      "#cm-award-date":"award_date",
      "#cm-award-level":"award_level",
      "#cm-book-author":"book_author",
      "#cm-book-publisher":"publisher",
      "#cm-book-year":"publication_year",
      "#cm-book-isbn":"isbn",
      "#cm-book-pages":"page_count",
      "#cm-book-price":"price",
      "#cm-book-language":"book_language",
      "#cm-book-buy-url":"purchase_url",
      "#cm-article-publication":"publication_name",
      "#cm-article-date":"publication_date",
      "#cm-article-author":"article_author",
      "#cm-article-url":"article_url",
      "#cm-saint-name":"saint_name",
      "#cm-saint-period":"saint_period",
      "#cm-saint-place":"saint_place",
      "#cm-saint-profile-url":"profile_url",
      "#cm-saint-lineage":"sufi_lineage",
      "#cm-saint-sources":"sources"
    };

    Object.entries(metadataFields).forEach(([selector, key]) => {
      set(selector, record[key]);
    });

    $("#cm-form").hidden = false;
    $("#cm-form-heading").textContent = "Edit record";
    $("#cm-save").textContent = "Update record";

    selectWorkspace(workspaceForType(record.type));
    updateFieldVisibility();

    $("#cm-form").scrollIntoView({behavior:"smooth",block:"start"});
  }
  
  function validateUrl(value, label) {
    if (!value) return true;

    try {
      const parsed = new URL(value, window.location.origin);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error();
      }
      return true;
    } catch {
      notice(`${label} must be a valid http:// or https:// URL.`, true);
      return false;
    }
  }

  async function saveContent(event) {
    event.preventDefault();

    const saveButton = $("#cm-save");
    const title = val("#cm-title");
    const type = val("#cm-type");
    const slug = val("#cm-slug");

    if (!title || !type || !slug) {
      notice("Please complete the main title, record type and URL slug.", true);
      return;
    }

    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      notice(
        "The URL slug must use lowercase English letters, numbers and single hyphens.",
        true
      );
      return;
    }

    const sortOrder = Number(raw("#cm-sort") || 0);

    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      notice("Display order must be a non-negative whole number.", true);
      return;
    }

    if (!validateUrl(val("#cm-image"), "Image URL")) return;
    if (!validateUrl(val("#cm-book-buy-url"), "Book URL")) return;
    if (!validateUrl(val("#cm-article-url"), "Article URL")) return;

    const payload = {
      title,
      type,
      slug,
      category: val("#cm-category"),
      status: val("#cm-status") || "draft",
      summary: val("#cm-summary"),
      body: raw("#cm-body"),
      image_url: val("#cm-image") || null,
      seo_title: val("#cm-seo-title"),
      seo_description: val("#cm-seo-description"),
      sort_order: sortOrder,
      featured: $("#cm-featured").checked,

      poem_type: val("#cm-poem-type") || type,
      language_primary: val("#cm-language-primary") || "urdu",
      poet_name: val("#cm-poet-name"),
      takhallus: val("#cm-takhallus"),
      radeef: val("#cm-radeef"),
      qaafiya: val("#cm-qaafiya"),
      beher: val("#cm-beher"),
      text_urdu: raw("#cm-text-urdu"),
      text_roman: raw("#cm-text-roman"),
      text_hindi: raw("#cm-text-hindi"),
      poetry_notes: raw("#cm-poetry-notes"),

      title_urdu: val("#cm-title-urdu"),
      title_hindi: val("#cm-title-hindi"),
      title_roman: val("#cm-title-roman"),

      award_name: val("#cm-award-name"),
      award_year: val("#cm-award-year") ? Number(val("#cm-award-year")) : null,
      award_organisation: val("#cm-award-organisation"),
      award_location: val("#cm-award-location"),
      award_date: val("#cm-award-date") || null,
      award_level: val("#cm-award-level"),

      book_author: val("#cm-book-author"),
      publisher: val("#cm-book-publisher"),
      publication_year: val("#cm-book-year") ? Number(val("#cm-book-year")) : null,
      isbn: val("#cm-book-isbn"),
      page_count: val("#cm-book-pages") ? Number(val("#cm-book-pages")) : null,
      price: val("#cm-book-price"),
      book_language: val("#cm-book-language"),
      purchase_url: val("#cm-book-buy-url") || null,

      publication_name: val("#cm-article-publication"),
      publication_date: val("#cm-article-date") || null,
      article_author: val("#cm-article-author"),
      article_url: val("#cm-article-url") || null,

      saint_name: val("#cm-saint-name"),
      saint_period: val("#cm-saint-period"),
      saint_place: val("#cm-saint-place"),
      profile_url: val("#cm-saint-profile-url"),
      sufi_lineage: val("#cm-saint-lineage"),
      sources: val("#cm-saint-sources")
    };

    saveButton.disabled = true;
    notice(editingId ? "Updating record…" : "Saving record…");

    try {
      await apiRequest(
        editingId ? "PATCH" : "POST",
        payload,
        editingId || undefined
      );

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
    const record = contentRecords.find(
      item => String(item.id) === String(id)
    );

    if (!record) return;

    if (action === "edit") {
      editContent(id);
      return;
    }

    if (action === "toggle") {
      const newStatus =
        record.status === "published" ? "draft" : "published";

      if (!confirm(
        `${newStatus === "published" ? "Publish" : "Unpublish"} "${record.title}"?`
      )) return;

      button.disabled = true;

      try {
        await apiRequest("PATCH", {status:newStatus}, id);
        await loadContent();
        notice(`Record is now ${newStatus}.`);
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

        if (String(editingId) === String(id)) resetForm();

        await loadContent();
        notice("Record deleted.");
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

    const emailLabel = $("#admin-email");
    if (emailLabel) emailLabel.textContent = user.email || "Signed in";

    showLoginError("");
    ensureContentInterface();
    await loadContent();
  }

  async function checkSession() {
    const {data, error} = await client.auth.getSession();

    if (error || !data.session) {
      await showLogin();
      return;
    }

    await showDashboard(data.session.user);
  }

  loginForm?.addEventListener("submit", async event => {
    event.preventDefault();
    showLoginError("");

    const email = $("#email")?.value.trim();
    const password = $("#password")?.value;
    const submitButton = loginForm.querySelector('button[type="submit"]');

    if (!email || !password) {
      showLoginError("Enter your email address and password.");
      return;
    }

    if (submitButton) submitButton.disabled = true;
    showLoginError("Signing in…");

    try {
      const {data, error} = await client.auth.signInWithPassword({
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
    if (event === "SIGNED_OUT" || !session) showLogin();
  });

  await checkSession();
});

