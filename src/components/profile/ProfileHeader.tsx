'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AvatarDisplay } from './AvatarDisplay'
import { TasteTagPill } from './TasteTagPill'
import { ProfileEditForm } from './ProfileEditForm'

interface ProfileHeaderProps {
  username: string
  displayName: string | null
  bio: string | null
  avatarUrl: string | null
  isOwner: boolean
  followerCount: number
  followingCount: number
  watchCount: number
  wishlistCount: number
  tasteTags: string[]
}

export function ProfileHeader(props: ProfileHeaderProps) {
  const [editing, setEditing] = useState(false)

  if (editing && props.isOwner) {
    return (
      <header className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold">Edit Profile</h2>
        <ProfileEditForm
          initial={{
            displayName: props.displayName,
            avatarUrl: props.avatarUrl,
            bio: props.bio,
          }}
          onDone={() => setEditing(false)}
        />
      </header>
    )
  }

  return (
    <header className="flex flex-col gap-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:py-12">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
        <AvatarDisplay
          avatarUrl={props.avatarUrl}
          displayName={props.displayName}
          username={props.username}
          size={96}
        />
        <div className="text-center sm:text-left">
          <h1 className="text-xl font-semibold">
            {props.displayName ?? `@${props.username}`}
          </h1>
          {props.displayName && (
            <p className="text-sm text-muted-foreground">@{props.username}</p>
          )}
          {props.bio && (
            <p className="mt-2 text-sm leading-relaxed sm:max-w-prose">
              {props.bio}
            </p>
          )}
          <p className="mt-3 text-sm text-muted-foreground">
            {props.followerCount} followers · {props.followingCount} following
            · {props.watchCount} watches · {props.wishlistCount} wishlist
          </p>
          {props.tasteTags.length > 0 && (
            <ul className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
              {props.tasteTags.map((tag) => (
                <li key={tag}>
                  <TasteTagPill>{tag}</TasteTagPill>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {props.isOwner && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditing(true)}
          className="self-center sm:self-start"
        >
          Edit Profile
        </Button>
      )}
    </header>
  )
}
