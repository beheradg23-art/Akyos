// App-wide appearance/theme system.
//
// Two different mechanisms are in play here, because the two families of
// theme want different scopes:
//
// 1. Black & White Minimalism [dark]/[light] are meant to affect
//    *everything* on screen, no exceptions — so they're a full-viewport
//    overlay (#theme-overlay, a plain sibling element declared in
//    index.html — see index.css) using `backdrop-filter: grayscale()`
//    (+ `invert()` for the light variant). backdrop-filter recolors
//    whatever is rendered behind an element without that element ever
//    becoming an ancestor of anything in the real DOM, which matters:
//    a plain `filter` on <html>/<body> would make that ancestor the
//    containing block for every `position: fixed` descendant (sidebar,
//    modal/toast portals, the auth screen's centering wrapper...) instead
//    of the real viewport, breaking their positioning the moment the
//    page scrolls. backdrop-filter on a non-ancestor sibling gets the
//    same "everything recolors" result with zero layout side effects.
//
// 2. The 4 color washes (Ember Forge, Blush Riot, Crimson Veil, Jade
//    Frost) are scoped narrower on purpose: they re-hue *only* the app's
//    actual brand accent colors (violet, fuchsia, purple, and indigo —
//    every one of them used somewhere as UI chrome: buttons, focus
//    rings, active states, the brand gradient), not literally every
//    color on screen. A blanket page-level filter can't do that —
//    hue-rotate shifts every hue uniformly, so it would just as happily
//    repaint the countdown/subject color palettes' amber, emerald,
//    cyan, etc., which are meant to stay put regardless of theme.
//    Instead, those four Tailwind scales are pointed at CSS custom
//    properties (see tailwind.config.js), and those variables' values
//    change per theme (see index.css) — so every existing `violet-*`,
//    `fuchsia-*`, `purple-*`, and `indigo-*` class anywhere in the app
//    picks up the new hue automatically, with zero component files
//    touched, while every other color is untouched. That includes the
//    countdown/subject palettes' own "violet", "fuchsia", and "sky" —
//    sky being built from indigo — entries in appConfig.ts: those are
//    plain classes from these same four scales too, so a countdown or
//    subject colored "violet" re-hues right along with everything else.
//
// This module only toggles a class on <html> — the actual recoloring
// rules live in index.css, keyed off that same class (applied to
// #theme-overlay for the two B&W themes, to the --violet-*, --fuchsia-*,
// --purple-*, and --indigo-* variables for the 4 color washes).
import React from 'react';

export type ThemeMode = 'colorful' | 'mono-dark' | 'mono-light' | 'ember' | 'blush' | 'crimson' | 'jade';

export const THEME_STORAGE_KEY = 'app_theme_v1';

export const THEME_OPTIONS: { id: ThemeMode; label: string; description: string }[] = [
  { id: 'mono-dark', label: 'Black & White Minimalism', description: 'Dark — every color desaturates to gray on a near-black shell' },
  { id: 'mono-light', label: 'Black & White Minimalism', description: 'Light — same desaturation, inverted to a near-white shell' },
  { id: 'ember', label: 'Ember Forge', description: 'Warm, fiery orange & amber brand accent' },
  { id: 'blush', label: 'Blush Riot', description: 'Bold, glam pink & magenta brand accent' },
  { id: 'crimson', label: 'Crimson Veil', description: 'Deep, moody vampiric red brand accent' },
  { id: 'jade', label: 'Jade Frost', description: 'Crisp, clean green brand accent' },
  { id: 'colorful', label: 'Colorful (Default)', description: "Akyos' full color palette" },
];

const THEME_CLASS_MAP: Record<ThemeMode, string | null> = {
  colorful: null,
  'mono-dark': 'theme-mono-dark',
  'mono-light': 'theme-mono-light',
  ember: 'theme-ember',
  blush: 'theme-blush',
  crimson: 'theme-crimson',
  jade: 'theme-jade',
};

const ALL_THEME_MODES: ThemeMode[] = ['colorful', 'mono-dark', 'mono-light', 'ember', 'blush', 'crimson', 'jade'];
const ALL_THEME_CLASSES = Object.values(THEME_CLASS_MAP).filter(Boolean) as string[];

export function isThemeMode(v: any): v is ThemeMode {
  return ALL_THEME_MODES.includes(v);
}

export function readStoredTheme(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeMode(raw)) return raw;
  } catch {
    // localStorage unavailable (private mode, etc.) — fall back silently.
  }
  return 'colorful';
}

// Applies the theme class to <html>. Exported standalone (not just used
// inside the provider) so main.tsx can call it synchronously before the
// first paint, avoiding a flash of the wrong palette on load.
export function applyThemeClass(mode: ThemeMode) {
  const root = document.documentElement;
  root.classList.remove(...ALL_THEME_CLASSES);
  const cls = THEME_CLASS_MAP[mode];
  if (cls) root.classList.add(cls);

  // Keep the mobile browser chrome (status bar / task switcher strip) in
  // sync with whichever shell color is actually on screen, instead of
  // leaving it hardcoded to the colorful app's near-black. Every theme
  // except the light monochrome one keeps the app's near-black shell
  // (the color washes tint it, they don't invert it to a light shell).
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', mode === 'mono-light' ? '#fafafa' : '#09090b');
}

export const ThemeContext = React.createContext<{
  theme: ThemeMode;
  setTheme: (mode: ThemeMode) => void;
}>({
  theme: 'colorful',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeMode>(() => readStoredTheme());

  const setTheme = React.useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    applyThemeClass(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // best-effort persistence only
    }
  }, []);

  // Keep <html> in sync (covers the initial mount, and any external change).
  React.useEffect(() => {
    applyThemeClass(theme);
  }, [theme]);

  const value = React.useMemo(() => ({ theme, setTheme }), [theme, setTheme]);

  return React.createElement(ThemeContext.Provider, { value }, children);
}

export function useTheme() {
  return React.useContext(ThemeContext);
}