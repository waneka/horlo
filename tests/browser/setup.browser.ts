// tests/browser/setup.browser.ts
//
// Setup file for the Vitest browser project.
//
// Imports globals.css so Tailwind 4 PostCSS output is served to the Chromium
// iframe where browser tests run. Without this import, window.getComputedStyle()
// returns empty strings / browser defaults for Tailwind utility classes.
//
// Referenced by vitest.workspace.ts browser project setupFiles.
// See: 42-RESEARCH.md §Open Questions item 3 (A3 assumption + fix)

import '../../src/app/globals.css'
