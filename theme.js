
(() => {
  const root = document.documentElement;
  const storageKey = "site-theme";

  let savedTheme = null;

  try {
    savedTheme = localStorage.getItem(storageKey);
  } catch (e) {}

  const systemTheme = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches ? "dark" : "light";

  function applyTheme(theme) {
    root.dataset.theme = theme;

    try {
      localStorage.setItem(storageKey, theme);
    } catch (e) {}

    updateButton();
  }

  function updateButton() {
    const button = document.getElementById("themeToggle");
    if (!button) return;

    const dark = root.dataset.theme === "dark";

    button.innerHTML = dark
      ? '<span aria-hidden="true">☀</span><span>Light Mode</span>'
      : '<span aria-hidden="true">☾</span><span>Dark Mode</span>';

    button.setAttribute(
      "aria-label",
      dark ? "Switch to light theme" : "Switch to dark theme"
    );

    button.setAttribute("aria-pressed", String(dark));
  }

  // Apply theme before the page finishes rendering.
  applyTheme(
    savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : systemTheme
  );

  function insertButton() {
    // Do not create duplicate buttons.
    if (document.getElementById("themeToggle")) return;

    // Use the site's existing header/navigation.
    const target = document.querySelector(
      "#mainNav, nav[aria-label='Main navigation'], header"
    );

    if (!target) return;

    const button = document.createElement("button");
    button.id = "themeToggle";
    button.type = "button";
    button.className = "theme-toggle";

    button.addEventListener("click", () => {
      applyTheme(
        root.dataset.theme === "dark" ? "light" : "dark"
      );
    });

    target.appendChild(button);
    updateButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", insertButton);
  } else {
    insertButton();
  }
})();
