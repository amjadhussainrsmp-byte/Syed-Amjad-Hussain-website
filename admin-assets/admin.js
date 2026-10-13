// Initialize Supabase if available
let supabaseClient = null;
if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
  supabaseClient = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
} else {
  console.warn("Supabase keys not found in admin-config.js!");
}

let activeCategory = 'poetry';

// Category Form Definitions
const categoryConfigs = {
  poetry: {
    title: "Poetry Studio",
    desc: "Create a ghazal, naat, manqabat, bait, or salam in Urdu, Hindi, and Roman Urdu.",
    fields: `
      <div class="form-group">
        <label>Main Title *</label>
        <input type="text" id="title" required class="form-input" placeholder="e.g. Harf-e-Musarrat">
      </div>
      <div class="form-group">
        <label>Record Type *</label>
        <select id="poetry_type" class="form-input">
          <option value="ghazal">Ghazal</option>
          <option value="naat">Naat</option>
          <option value="manqabat">Manqabat</option>
          <option value="bait">Bait</option>
          <option value="salam">Salam</option>
        </select>
      </div>
      <div class="form-group">
        <label>Urdu Text (Kalam)</label>
        <textarea id="text_urdu" dir="rtl" rows="4" class="form-input" placeholder="اردو متن..."></textarea>
      </div>
      <div class="form-group">
        <label>Hindi Text</label>
        <textarea id="text_hindi" rows="4" class="form-input" placeholder="हिंदी पाठ..."></textarea>
      </div>
      <div class="form-group">
        <label>Roman Urdu Text</label>
        <textarea id="text_roman" rows="4" class="form-input" placeholder="Roman text..."></textarea>
      </div>
    `
  },
  sher: {
    title: "Sher Collection",
    desc: "Add individual couplets in Urdu, Hindi, and Roman Urdu.",
    fields: `
      <div class="form-group">
        <label>First Line / Identifier *</label>
        <input type="text" id="title" required class="form-input" placeholder="e.g. Misra or topic tag">
      </div>
      <div class="form-group">
        <label>Couplet (Urdu Script)</label>
        <textarea id="sher_urdu" dir="rtl" rows="3" class="form-input" placeholder="شعر اردو میں..."></textarea>
      </div>
      <div class="form-group">
        <label>Couplet (Hindi / Devanagari)</label>
        <textarea id="sher_hindi" rows="3" class="form-input" placeholder="शेर हिंदी में..."></textarea>
      </div>
      <div class="form-group">
        <label>Couplet (Roman Urdu)</label>
        <textarea id="sher_roman" rows="3" class="form-input" placeholder="Sher in Roman Urdu..."></textarea>
      </div>
    `
  },
  awards: {
    title: "Awards & Honours",
    desc: "Record award names, years, awarding bodies, and supporting details.",
    fields: `
      <div class="form-group">
        <label>Award Title *</label>
        <input type="text" id="title" required class="form-input" placeholder="e.g. National Sufi Excellence Award">
      </div>
      <div class="form-group">
        <label>Awarding Body / Organization</label>
        <input type="text" id="organization" class="form-input" placeholder="e.g. Literary Academy">
      </div>
      <div class="form-group">
        <label>Year Received</label>
        <input type="number" id="year" class="form-input" placeholder="e.g. 2026">
      </div>
      <div class="form-group">
        <label>Description / Citation</label>
        <textarea id="description" rows="3" class="form-input"></textarea>
      </div>
    `
  },
  books: {
    title: "Books & Publications",
    desc: "Manage book titles, publishers, publication years, and buying links.",
    fields: `
      <div class="form-group">
        <label>Book Title *</label>
        <input type="text" id="title" required class="form-input" placeholder="e.g. Bihar Aur Sufivad">
      </div>
      <div class="form-group">
        <label>Publisher</label>
        <input type="text" id="publisher" class="form-input" placeholder="Publisher name">
      </div>
      <div class="form-group">
        <label>Publication Year</label>
        <input type="number" id="year" class="form-input" placeholder="2026">
      </div>
      <div class="form-group">
        <label>Cover Image URL</label>
        <input type="text" id="cover_url" class="form-input" placeholder="https://...">
      </div>
      <div class="form-group">
        <label>Overview / Summary</label>
        <textarea id="description" rows="4" class="form-input"></textarea>
      </div>
    `
  },
  articles: {
    title: "Articles & Research",
    desc: "Add articles, historical research writings, and publications.",
    fields: `
      <div class="form-group">
        <label>Article Title *</label>
        <input type="text" id="title" required class="form-input" placeholder="Research paper title">
      </div>
      <div class="form-group">
        <label>Topic / Category</label>
        <input type="text" id="topic" class="form-input" placeholder="e.g. History, Sufism">
      </div>
      <div class="form-group">
        <label>Article Content / Summary</label>
        <textarea id="description" rows="6" class="form-input"></textarea>
      </div>
    `
  },
  sufi: {
    title: "Sufi Heritage & Saints",
    desc: "Add saint profile, location, short biography, and details.",
    fields: `
      <div class="form-group">
        <label>Saint Name *</label>
        <input type="text" id="title" required class="form-input" placeholder="Saint's Name">
      </div>
      <div class="form-group">
        <label>Location / Shrine</label>
        <input type="text" id="location" class="form-input" placeholder="e.g. Bihar Sharif">
      </div>
      <div class="form-group">
        <label>Biography / Profile Notes</label>
        <textarea id="description" rows="5" class="form-input"></textarea>
      </div>
    `
  },
  all: {
    title: "All Content Archive",
    desc: "View and filter all created items.",
    fields: `<div id="content-list"><p style="color:#666;">Loading saved items from database...</p></div>`
  }
};

// Switch Category Tab Logic
function switchCategory(cat, element) {
  activeCategory = cat;
  
  // Highlight active button
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  if (element) element.classList.add('active');

  // Update Form Header
  const config = categoryConfigs[cat];
  document.getElementById('form-title').innerText = config.title;
  document.getElementById('form-desc').innerText = config.desc;

  // Inject Custom Fields
  const dynamicContainer = document.getElementById('dynamic-fields');
  const submitBtn = document.getElementById('submit-btn');

  dynamicContainer.innerHTML = config.fields;

  if (cat === 'all') {
    submitBtn.style.display = 'none';
    loadAllContent();
  } else {
    submitBtn.style.display = 'block';
  }
}

// Form Submit Handler
async function handleFormSubmit(event) {
  event.preventDefault();

  const data = {
    category: activeCategory,
    created_at: new Date().toISOString()
  };

  // Extract values from dynamic fields
  const inputs = document.querySelectorAll('#dynamic-fields input, #dynamic-fields textarea, #dynamic-fields select');
  inputs.forEach(input => {
    if (input.id) data[input.id] = input.value;
  });

  if (supabaseClient) {
    const { error } = await supabaseClient.from(activeCategory).insert([data]);
    if (error) {
      alert("Error saving: " + error.message);
    } else {
      alert("Saved successfully to " + categoryConfigs[activeCategory].title + "!");
      document.getElementById('admin-form').reset();
    }
  } else {
    console.log("Local Mode Payload:", data);
    alert("Saved! (Check console for local payload. Connect Supabase config to save live).");
    document.getElementById('admin-form').reset();
  }
}

// Fetch All Items for "All Content" Tab
async function loadAllContent() {
  const container = document.getElementById('content-list');
  if (!supabaseClient) {
    container.innerHTML = `<p style="color:#999;">Supabase is not configured yet. Add <b>admin-config.js</b> to view live data.</p>`;
    return;
  }
  
  // Fetch sample items from poetry table
  const { data, error } = await supabaseClient.from('poetry').select('*').limit(10);
  if (error || !data || data.length === 0) {
    container.innerHTML = `<p>No items found in database.</p>`;
    return;
  }

  container.innerHTML = data.map(item => `
    <div class="item-row">
      <strong>${item.title || 'Untitled'}</strong> 
      <span style="font-size:12px; color:#888;">(${item.poetry_type || 'Record'})</span>
    </div>
  `).join('');
}

// Default Initialize on Page Load
window.addEventListener('DOMContentLoaded', () => {
  switchCategory('poetry', document.querySelector('.tab-btn.active'));
});
