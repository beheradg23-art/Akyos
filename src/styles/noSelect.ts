// ---------------------------------------------------------------------------
// Global text-selection lockdown.
//
// Clicking around the UI quickly (checking off tracker items, tapping
// checkboxes, dragging across cards) was leaving blue text-selection
// highlights everywhere, since the browser's default is "everything is
// selectable." This flips that default off app-wide and then explicitly
// turns it back on only for the handful of elements that actually need
// it — real text-entry fields and anything explicitly marked editable/
// selectable.
//
// Usage: render `<style>{NO_SELECT_CSS}</style>` once near the top of any
// top-level screen (AuthGate, PasswordGate, OnboardingWizard, the main
// JEEDashboard tree) — each of those is a separate early-return root, so
// each needs its own copy rather than one shared mount point.
// ---------------------------------------------------------------------------

export const NO_SELECT_CSS = `
  * {
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
  }
  input, textarea, select, [contenteditable="true"], [contenteditable=""] {
    -webkit-user-select: text;
    -moz-user-select: text;
    user-select: text;
  }
  /* Escape hatch for any element that genuinely needs to be copy-able
     (e.g. a code snippet or an API key) — opt back in with this class. */
  .allow-select {
    -webkit-user-select: text;
    -moz-user-select: text;
    user-select: text;
  }
`;