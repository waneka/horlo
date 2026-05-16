// vitest.workspace.ts
//
// Two-project Vitest workspace (DEBT-10 / 42-01).
//
// Project "unit":  inherits vitest.config.ts (jsdom, setupFiles, globals, alias)
//                  runs all existing .test.{ts,tsx} files
//
// Project "browser": real Chromium via Playwright provider (v2.x string API)
//                    runs *.browser.test.{ts,tsx} files in tests/browser/
//
// v2.x API note: provider is the string 'playwright', NOT the playwright function-call
// import from @vitest/browser-playwright (that is a v3/v4-only package).
//
// `npm test` (vitest run) auto-detects this file and runs both projects.
// No change to the package.json "test" script required.

import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  {
    // Inherit jsdom environment, setupFiles, globals, and @/* alias from existing config
    extends: './vitest.config.ts',
    test: {
      name: 'unit',
      include: [
        'tests/**/*.test.ts',
        'tests/**/*.test.tsx',
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
      ],
      // CRITICAL: exclude browser tests from the unit/jsdom project
      exclude: ['tests/browser/**'],
    },
  },
  {
    test: {
      name: 'browser',
      include: ['tests/browser/**/*.browser.test.{ts,tsx}'],
      browser: {
        enabled: true,
        provider: 'playwright',  // v2.x: string literal — NOT the function-import form
        name: 'chromium',        // v2.x: `name` field — NOT `instances[0].browser`
        headless: true,
      },
      resolve: {
        alias: {
          // Replicate the @/* alias — browser project does not inherit vitest.config.ts
          '@': new URL('./src', import.meta.url).pathname,
        },
      },
    },
  },
])
