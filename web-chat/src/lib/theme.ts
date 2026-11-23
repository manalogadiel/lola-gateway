import type { ThemePreference } from "./types";

const STORAGE_KEY = "lola_gateway_theme_pref";

export function loadThemePreference(): ThemePreference {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark" || saved === "auto") {
      return saved;
    }
  } catch {
    // Ignore storage access errors in private contexts.
  }
  return "auto";
}

export function saveThemePreference(pref: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Ignore storage access errors.
  }
}

export function resolveTheme(
  pref: ThemePreference,
  prefersDark: boolean
): "light" | "dark" {
  if (pref === "auto") {
    return prefersDark ? "dark" : "light";
  }
  return pref;
}

export function applyDocumentTheme(mode: "light" | "dark"): void {
  const root = document.documentElement;
  root.classList.add("theme-switching");
  root.setAttribute("data-theme", mode);

  const metaScheme = document.getElementById("meta-color-scheme");
  if (metaScheme) {
    metaScheme.setAttribute(
      "content",
      mode === "dark" ? "dark only" : "light only"
    );
  }

  const metaThemeColor = document.getElementById("meta-theme-color");
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      "content",
      mode === "dark" ? "#0E0D16" : "#F8F5EF"
    );
  }

  void root.offsetHeight;
  requestAnimationFrame(() => root.classList.remove("theme-switching"));
}
