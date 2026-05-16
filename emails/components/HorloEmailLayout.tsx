/**
 * Shared email layout for all Horlo transactional auth emails.
 *
 * D-09: This file lives in the build-excluded emails/ directory at repo root.
 *       It follows react-email conventions, NOT CLAUDE.md src/ conventions.
 * D-10: The header is a styled Horlo text wordmark — NOT a hosted img logo.
 * D-11: All colors are hex literals only (no oklch — unsupported by Outlook MSO).
 *
 * Accent conversion: CSS Color 4 spec exact calculation -> #DDA552
 */
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Preview,
} from '@react-email/components'
import type { ReactNode } from 'react'

// D-11: accent hex — exact CSS Color 4 spec oklab matrix calculation of the app --accent token
// R=221 G=165 B=82 => #DDA552 (UI-SPEC used an approximate value; this is the exact conversion)
const ACCENT = '#DDA552'

interface HorloEmailLayoutProps {
  preview: string
  children: ReactNode
}

export function HorloEmailLayout({ preview, children }: HorloEmailLayoutProps) {
  return (
    <Html>
      <Head>
        {/* Pitfall 5: Apple Mail iOS dark mode — opt-in to explicit light/dark handling */}
        <meta name="color-scheme" content="light dark" />
        <meta name="supported-color-schemes" content="light dark" />
      </Head>
      <Preview>{preview}</Preview>
      {/* Pitfall 6: Gmail strips <style> blocks — all styling via inline style props */}
      <Body
        style={{
          backgroundColor: '#FFFFFF',
          margin: 0,
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        <Container
          style={{
            width: '600px',
            maxWidth: '100%',
            margin: '0 auto',
            padding: '32px 24px',
          }}
        >
          {/* D-10: Text wordmark — not an <img> logo */}
          <Section>
            <Text
              style={{
                fontSize: '24px',
                fontWeight: 700,
                color: ACCENT,
                margin: 0,
              }}
            >
              Horlo
            </Text>
          </Section>

          <Hr style={{ borderColor: '#E5E5E5' }} />

          {children}

          <Hr style={{ borderColor: '#E5E5E5' }} />

          <Section>
            <Text
              style={{
                fontSize: '13px',
                color: '#888888',
              }}
            >
              You&apos;re receiving this because someone used this address to sign in to Horlo.
              If that wasn&apos;t you, you can safely ignore this email.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}
