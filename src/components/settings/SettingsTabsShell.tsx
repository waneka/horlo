'use client'

import { useEffect, useState, Suspense } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { User, IdCard, SlidersHorizontal, Lock, Bell, Palette } from 'lucide-react'
import { StatusToastHandler } from './StatusToastHandler'
import { AppearanceSection } from './AppearanceSection'
import type { UserPreferences } from '@/lib/types'
import type { ProfileSettings } from '@/data/profiles'

const SECTION_ORDER = [
  'account',
  'profile',
  'preferences',
  'privacy',
  'notifications',
  'appearance',
] as const
type SectionId = (typeof SECTION_ORDER)[number]
const isSectionId = (s: string): s is SectionId =>
  (SECTION_ORDER as readonly string[]).includes(s)

/**
 * D-16: hash format is `#tab` for the basic case and `#tab?key=value` for
 * status-carrying links (e.g., #account?status=email_changed per SET-06).
 * This non-standard URL shape is mandated by SET-06; the parser is
 * documented inline.
 */
function parseHash(hash: string): SectionId {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const [tab] = raw.split('?', 2)
  return isSectionId(tab) ? tab : 'account'
}

interface SettingsTabsShellProps {
  // Profile data
  username: string
  displayName: string | null
  avatarUrl: string | null
  profilePublic: boolean
  // Account state
  currentEmail: string
  pendingNewEmail: string | null
  lastSignInAt: string | null // ISO; RECONCILED D-08 freshness signal
  // Settings + preferences for downstream sections (Plan 05 wires these)
  settings: ProfileSettings
  preferences: UserPreferences
}

/**
 * Phase 22 SET-01 / SET-02 / SET-03 — Settings vertical-tabs shell.
 *
 * Hash-driven routing: mount-time read, pushState write, hashchange listener.
 * D-17: default tab is `#account` when hash is empty (replaceState to keep URL
 * shareable). D-18: hashchange listener handles browser back/forward.
 *
 * Plans 03/04/05 wire AccountSection / ProfileSection / PrivacySection /
 * NotificationsSection / PreferencesSection into the panel slots; until then,
 * placeholders render with a forward-pointer to Plan 05.
 */
export function SettingsTabsShell(props: SettingsTabsShellProps) {
  const [activeTab, setActiveTab] = useState<SectionId>('account')

  // D-17: Mount — read hash; if empty, replaceState to #account.
  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, '', '/settings#account')
      return
    }
    setActiveTab(parseHash(window.location.hash))
  }, [])

  // D-18: hashchange listener handles browser back/forward.
  useEffect(() => {
    function onHashChange() {
      setActiveTab(parseHash(window.location.hash))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  function handleValueChange(value: string) {
    if (!isSectionId(value)) return
    setActiveTab(value)
    // SET-02: pushState ONLY — the Next.js router would re-run the page Server
    // Component loader on a hash change, defeating the SPA tab-switch UX
    // (Pitfall 1 from 22-RESEARCH.md).
    window.history.pushState(null, '', `#${value}`)
  }

  return (
    <>
      {/* D-13 status toast handler — Suspense per Pitfall 3 (useSearchParams
          without Suspense bails Next.js 16 prerender). */}
      <Suspense fallback={null}>
        <StatusToastHandler />
      </Suspense>

      <Tabs
        orientation="vertical"
        value={activeTab}
        onValueChange={handleValueChange}
        className="mt-6 flex-col gap-4 sm:flex-row sm:gap-6"
      >
        <TabsList
          variant="line"
          className="w-full overflow-x-auto sm:w-44 sm:self-start sm:sticky sm:top-4"
        >
          <TabsTrigger value="account">
            <User /> Account
          </TabsTrigger>
          <TabsTrigger value="profile">
            <IdCard /> Profile
          </TabsTrigger>
          <TabsTrigger value="preferences">
            <SlidersHorizontal /> Preferences
          </TabsTrigger>
          <TabsTrigger value="privacy">
            <Lock /> Privacy
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell /> Notifications
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette /> Appearance
          </TabsTrigger>
        </TabsList>

        <div className="min-w-0 flex-1">
          <TabsContent value="account">
            {/* PLACEHOLDER — Plan 05 wires <AccountSection> here, which will
                in turn render <EmailChangeForm> (Plan 03) +
                <PasswordChangeForm> (Plan 04). */}
            <PanelPlaceholder label="Account" planRef="22-05" />
          </TabsContent>
          <TabsContent value="profile">
            {/* PLACEHOLDER — Plan 05 wires <ProfileSection> (D-19 stub) here. */}
            <PanelPlaceholder label="Profile" planRef="22-05" />
          </TabsContent>
          <TabsContent value="preferences">
            {/* PLACEHOLDER — Plan 05 wires <PreferencesSection>
                (PreferencesClient embed) here. */}
            <PanelPlaceholder label="Preferences" planRef="22-05" />
          </TabsContent>
          <TabsContent value="privacy">
            {/* PLACEHOLDER — Plan 05 wires <PrivacySection> here. */}
            <PanelPlaceholder label="Privacy" planRef="22-05" />
          </TabsContent>
          <TabsContent value="notifications">
            {/* PLACEHOLDER — Plan 05 wires <NotificationsSection> here. */}
            <PanelPlaceholder label="Notifications" planRef="22-05" />
          </TabsContent>
          <TabsContent value="appearance">
            <AppearanceSection />
          </TabsContent>
        </div>
      </Tabs>
    </>
  )
}

function PanelPlaceholder({
  label,
  planRef,
}: {
  label: string
  planRef: string
}) {
  return (
    <p className="text-sm text-muted-foreground">
      {label} section content lands in Plan {planRef}.
    </p>
  )
}
