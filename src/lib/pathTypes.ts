// PATH_TYPES vocab extracted from src/app/actions/cms/collectionPaths.ts:33
// Three consumers: CMS Server Action, PathEditorClient.tsx, /explore/paths page.
// Extracted to a plain lib module to avoid importing a 'use server' file from
// Server Component pages (D-05).
export const PATH_TYPES = [
  'Going Deeper',
  'Branching Out',
  'Trading Up',
  'Filling a Gap',
] as const

export type PathType = (typeof PATH_TYPES)[number]
