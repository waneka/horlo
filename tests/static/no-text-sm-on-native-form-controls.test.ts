// @vitest-environment node
//
// This guard walks the source tree (readdirSync + readFileSync). It MUST run
// in the `node` vitest environment — under jsdom (the default for this
// project), vite externalizes `node:fs` and these APIs become undefined.
// That difference is environment-dependent: passes locally under jsdom but
// FAILS the Vercel prebuild build (cost a failed Phase 59 prod deploy,
// retrofitted across Phase 71). MEMORY project_vitest_static_node_env
// records the recurrence — the `// @vitest-environment node` header on
// line 1 is load-bearing.
//
// Phase 74 MOB-01 D-12 — text-sm-on-native-form-controls regression guard.
//
// Durable rule (from .planning/phases/74-.../74-CONTEXT.md D-07 + D-12):
//   Within the limited v8.1 fixed-surface scope (src/components/comment/* +
//   src/components/watch/SearchEntry.tsx), no native form-control opening
//   tag (<textarea, <input, <select, <Combobox.Input) may carry a className
//   containing the bare token `text-sm` without a paired `md:text-sm` (or
//   other md: responsive companion that establishes 16px on mobile).
//
//   A bare `text-sm` (14px) on a native form control triggers iOS Safari
//   auto-zoom on focus. The correct token is `text-base md:text-sm` (16px
//   mobile, 14px desktop — mirrors shadcn Input + Textarea primitives at
//   src/components/ui/input.tsx + src/components/ui/textarea.tsx). This
//   guard fires a CI tripwire if a future contributor reverts any of the
//   three rewrites shipped by Phase 74 Plan 02 Task 1.
//
// SCOPE LIMIT (deliberate):
//   - Admin-only components (the admin/ subtree) are NOT walked — out of v8.1
//     scope per CONTEXT D-07 and intentionally retain their text-sm overrides.
//     Admin tooling is not part of the user-facing mobile path; widening this
//     guard there would widen the phase.
//   - The rest of the src/ tree is NOT walked — full-app enforcement is a
//     deferred ESLint-rule candidate per CONTEXT Deferred. If MOB-01 recurs
//     on a different surface, expand the scope file-by-file.
//   - This guard does NOT attempt to compute Tailwind font-size at runtime
//     (CONTEXT D-13 rejects that — jsdom + Tailwind compilation is not in
//     the test harness; pinch-zoom + actual auto-zoom is prod UAT only per
//     D-09).

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** Walk a directory recursively, returning all `.tsx` files as absolute paths. */
function walkTsxFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...walkTsxFiles(full))
    } else if (st.isFile() && entry.endsWith('.tsx')) {
      out.push(full)
    }
  }
  return out
}

const REPO_ROOT = resolve(__dirname, '..', '..')
const COMMENT_DIR = join(REPO_ROOT, 'src', 'components', 'comment')
const SEARCH_ENTRY = join(REPO_ROOT, 'src', 'components', 'watch', 'SearchEntry.tsx')

const FILES_TO_SCAN: string[] = [
  ...walkTsxFiles(COMMENT_DIR),
  SEARCH_ENTRY,
]

// Match a native form-control opening tag whose className string contains
// the bare token `text-sm` (NOT preceded by `:` so we don't match `md:text-sm`,
// NOT followed by a word char so we don't match e.g. `text-small`).
//
// Pattern explanation:
//   <(textarea|input|select|Combobox\.Input)\b      - native tag opening
//   [^>]*                                            - any attrs up to >
//   className="([^"]*)"                              - capture className string
// The regex is run globally; for each hit, we then inspect the captured
// className substring and check for `(?<![:\w])text-sm(?!\w)`.
const FORM_TAG_REGEX =
  /<(textarea|input|select|Combobox\.Input)\b[^>]*\bclassName="([^"]*)"/g

const BARE_TEXT_SM_REGEX = /(?<![:\w])text-sm(?!\w)/

describe('MOB-01 D-12 — no bare text-sm on native form controls in v8.1 fixed surfaces', () => {
  it('verifies the scan picks up the expected files (sanity check)', () => {
    // The scan must always include the three known-fixed surfaces. If a future
    // refactor moves any of them, this assertion fires before the body assertion
    // could ever silently pass against an empty file set.
    const relativized = FILES_TO_SCAN.map((p) =>
      p.replace(REPO_ROOT + '/', ''),
    )
    expect(relativized).toContain('src/components/comment/CommentCompose.tsx')
    expect(relativized).toContain('src/components/comment/CommentItem.tsx')
    expect(relativized).toContain('src/components/watch/SearchEntry.tsx')
  })

  it('no native form control in the fixed surfaces has bare text-sm without md:text-sm', () => {
    const violations: string[] = []

    for (const file of FILES_TO_SCAN) {
      const content = readFileSync(file, 'utf8')
      // Reset lastIndex on each iteration since FORM_TAG_REGEX is /g.
      FORM_TAG_REGEX.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = FORM_TAG_REGEX.exec(content)) !== null) {
        const [, tag, className] = match
        if (!BARE_TEXT_SM_REGEX.test(className)) continue
        // text-sm is present — check if md:text-sm is ALSO present (the allowed
        // responsive companion). If both, the pattern is correct: 16px on
        // mobile, 14px on md+. If text-sm alone, it's a violation.
        if (className.includes('md:text-sm')) continue
        const rel = file.replace(REPO_ROOT + '/', '')
        violations.push(`${rel} — <${tag} ...> className="${className}"`)
      }
    }

    expect(violations).toEqual([])
  })
})
