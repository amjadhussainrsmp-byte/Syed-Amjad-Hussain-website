document.addEventListener("DOMContentLoaded", async () => {
  const loginForm = document.getElementById("loginForm");
  const message = document.getElementById("loginMessage");

  if (!window.ADMIN_CONFIG || !window.supabase) {
    if (message) {
      message.textContent =
        "Admin configuration or Supabase library is missing.";
    }
    return;
  }

  const client = window.supabase.createClient(
    window.ADMIN_CONFIG.supabaseUrl,
    window.ADMIN_CONFIG.supabaseAnonKey
  );

  if (!loginForm) return;

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = loginForm.querySelector('[name="email"]').value.trim();
    const password = loginForm.querySelector('[name="password"]').value;
    const button = loginForm.querySelector('button[type="submit"]');

    if (button) button.disabled = true;
    if (message) message.textContent = "Signing in…";

    const { error } = await client.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      if (message) message.textContent = error.message;
      if (button) button.disabled = false;
      return;
    }

    window.location.href = "/admin-dashboard.html";
  });
});
