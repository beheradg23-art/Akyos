/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      // Every `violet-*`/`fuchsia-*` utility class in the app (buttons,
      // selected states, active nav, the sweep-gradient brand highlight,
      // etc.) is generated from these two scales. Re-pointing them at CSS
      // custom properties — instead of Tailwind's fixed hex values — is
      // what lets the Appearance color-wash themes (Ember Forge, Blush
      // Riot, Crimson Veil, Jade Frost) re-hue *only* the app's actual
      // brand accent everywhere it's used, without a single component
      // file changing and without touching any other color in the app.
      // The variables themselves (default + per-theme values) live in
      // index.css, keyed off the same `html.theme-*` class the rest of
      // the theme system already uses.
      //
      // The countdown color palette and the subject color palette (both in
      // appConfig.ts) also use 'violet'/'fuchsia'/'sky' as *user-facing
      // named color choices*. Those DO use these same Tailwind classes —
      // on purpose — so a countdown or subject someone colored "violet"
      // re-hues along with the rest of the brand accent when the
      // Appearance theme changes, same as everything else built from
      // these scales. Only the palettes' non-brand entries (amber,
      // emerald, rose, cyan...) stay fixed across themes, since those are
      // genuinely distinct status/identity colors, not the brand accent.
      colors: {
        violet: {
          50: 'rgb(var(--violet-50) / <alpha-value>)',
          100: 'rgb(var(--violet-100) / <alpha-value>)',
          200: 'rgb(var(--violet-200) / <alpha-value>)',
          300: 'rgb(var(--violet-300) / <alpha-value>)',
          400: 'rgb(var(--violet-400) / <alpha-value>)',
          500: 'rgb(var(--violet-500) / <alpha-value>)',
          600: 'rgb(var(--violet-600) / <alpha-value>)',
          700: 'rgb(var(--violet-700) / <alpha-value>)',
          800: 'rgb(var(--violet-800) / <alpha-value>)',
          900: 'rgb(var(--violet-900) / <alpha-value>)',
          950: 'rgb(var(--violet-950) / <alpha-value>)',
        },
        fuchsia: {
          50: 'rgb(var(--fuchsia-50) / <alpha-value>)',
          100: 'rgb(var(--fuchsia-100) / <alpha-value>)',
          200: 'rgb(var(--fuchsia-200) / <alpha-value>)',
          300: 'rgb(var(--fuchsia-300) / <alpha-value>)',
          400: 'rgb(var(--fuchsia-400) / <alpha-value>)',
          500: 'rgb(var(--fuchsia-500) / <alpha-value>)',
          600: 'rgb(var(--fuchsia-600) / <alpha-value>)',
          700: 'rgb(var(--fuchsia-700) / <alpha-value>)',
          800: 'rgb(var(--fuchsia-800) / <alpha-value>)',
          900: 'rgb(var(--fuchsia-900) / <alpha-value>)',
          950: 'rgb(var(--fuchsia-950) / <alpha-value>)',
        },
        // The Clock tab (and a few Primitives.tsx pieces) use Tailwind's
        // separate `purple` scale rather than `violet` — same brand
        // treatment applies here so those spots re-hue too.
        purple: {
          50: 'rgb(var(--purple-50) / <alpha-value>)',
          100: 'rgb(var(--purple-100) / <alpha-value>)',
          200: 'rgb(var(--purple-200) / <alpha-value>)',
          300: 'rgb(var(--purple-300) / <alpha-value>)',
          400: 'rgb(var(--purple-400) / <alpha-value>)',
          500: 'rgb(var(--purple-500) / <alpha-value>)',
          600: 'rgb(var(--purple-600) / <alpha-value>)',
          700: 'rgb(var(--purple-700) / <alpha-value>)',
          800: 'rgb(var(--purple-800) / <alpha-value>)',
          900: 'rgb(var(--purple-900) / <alpha-value>)',
          950: 'rgb(var(--purple-950) / <alpha-value>)',
        },
        // Generic UI accents (focus rings, selection outlines, active tab
        // pills, calendar selection rings, etc.) turned out to lean on
        // Tailwind's `indigo` scale as often as `violet` — same treatment.
        // (The countdown/subject palettes' "sky" option, which is also
        // built from `indigo-*` classes, uses these plain classes too, so
        // it re-hues with the theme same as violet/fuchsia.)
        indigo: {
          50: 'rgb(var(--indigo-50) / <alpha-value>)',
          100: 'rgb(var(--indigo-100) / <alpha-value>)',
          200: 'rgb(var(--indigo-200) / <alpha-value>)',
          300: 'rgb(var(--indigo-300) / <alpha-value>)',
          400: 'rgb(var(--indigo-400) / <alpha-value>)',
          500: 'rgb(var(--indigo-500) / <alpha-value>)',
          600: 'rgb(var(--indigo-600) / <alpha-value>)',
          700: 'rgb(var(--indigo-700) / <alpha-value>)',
          800: 'rgb(var(--indigo-800) / <alpha-value>)',
          900: 'rgb(var(--indigo-900) / <alpha-value>)',
          950: 'rgb(var(--indigo-950) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}