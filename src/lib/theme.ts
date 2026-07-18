// App-wide appearance/theme system.
//
// Design: rather than re-skinning every hardcoded Tailwind color utility
// across the codebase (thousands of `bg-*`/`text-*`/`from-*`/`to-*`
// classes, none of which were built with theming in mind), the two
// "Black & White Minimalism" modes are implemented as a single CSS
// `filter` applied to the whole rendered page (see the `.theme-mono-*`
// rules in index.css). A `filter` composites over an element's *entire*
// painted subtree — every color, gradient, shadow, and image beneath it —
// so nothing can accidentally stay hardcoded/colorful when a mono theme
// is active, and every animation (including animated gradients) keeps
// running exactly as-is; only the colors it paints change:
//   - [dark]  -> grayscale(1): every hue collapses to gray, dark stays dark,
//               light stays light (dark colors read as near-black, light
//               colors as near-white).
//   - [light] -> grayscale(1) + invert(1): same desaturation, then the
//               whole luminance range flips, so the near-black app shell
//               becomes a near-white one and vice versa.
// The theme class is applied to <html>, which covers portal-rendered UI
// (modals, toasts) too, since those still mount under <html>.
import React from 'react';

export type ThemeMode = 'colorful' | 'mono-dark' | 'mono-light';

export const THEME_STORAGE_KEY = 'app_theme_v1';

export const THEME_OPTIONS: { id: ThemeMode; label: string; description: string }[] = [
  { id: 'mono-dark', label: 'Black & White Minimalism', description: 'Dark — every color desaturates to gray on a near-black shell' },
  { id: 'mono-light', label: 'Black & White Minimalism', description: 'Light — same desaturation, inverted to a near-white shell' },
  { id: 'colorful', label: 'Colorful (Default)', description: "Akyos' full color palette" },
];

const THEME_CLASS_MAP: Record<ThemeMode, string | null> = {
  colorful: null,
  'mono-dark': 'theme-mono-dark',
  'mono-light': 'theme-mono-light',
};

export function isThemeMode(v: any): v is ThemeMode {
  return v === 'colorful' || v === 'mono-dark' || v === 'mono-light';
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
  root.classList.remove('theme-mono-dark', 'theme-mono-light');
  const cls = THEME_CLASS_MAP[mode];
  if (cls) root.classList.add(cls);

  // Keep the mobile browser chrome (status bar / task switcher strip) in
  // sync with whichever shell color is actually on screen, instead of
  // leaving it hardcoded to the colorful app's near-black.
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
