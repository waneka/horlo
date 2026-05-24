// Shared comment component types — home for CommentAuthor + CommentWithAuthor.
// Defined here (not in src/data/comments.ts) because Plan 02 owns that file this wave.

import type { Comment } from '@/data/comments'

export type CommentAuthor = {
  username: string
  displayName: string | null
  avatarUrl: string | null
}

export type CommentWithAuthor = Comment & { author: CommentAuthor }
