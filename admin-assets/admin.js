
document.addEventListener("DOMContentLoaded", async () => {
  const setupScreen = document.getElementById("setup-screen");
  const loginScreen = document.getElementById("login-screen");
  const app = document.getElementById("app");
  const loginForm = document.getElementById("login-form");
  const loginError = document.getElementById("login-error");
  const logoutButton = document.getElementById("logout-btn");

  function showError(message) {
    if (loginError) loginError.textContent = message;
  }

  if (
    !window.ADMIN_CONFIG ||
    !window.ADMIN_CONFIG.supabaseUrl ||
    !window.ADMIN_CONFIG.supabaseAnonKey ||
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

    showError("");
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
    showError("");

    const email = document.getElementById("email")?.value.trim();
    const password = document.getElementById("password")?.value;
    const submitButton = loginForm.querySelector(
      'button[type="submit"]'
    );

    if (!email || !password) {
      showError("Enter your email address and password.");
      return;
    }

    if (submitButton) submitButton.disabled = true;
    showError("Signing in…");

    const { data, error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (submitButton) submitButton.disabled = false;

    if (error) {
      showError(error.message);
      return;
    }

    showError("");
    await showDashboard(data.user);
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
