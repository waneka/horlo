/**
 * Reset password email template.
 *
 * D-12: CTA copy is action-specific — "Reset your password"
 * D-11: All colors are hex literals; the ACCENT constant is the exact conversion.
 *
 * The {{ .ConfirmationURL }} token is a literal Go-template string substituted
 * by Supabase GoTrue at send time. It must survive react-email export verbatim.
 */
import { Section, Heading, Text, Button } from '@react-email/components'
import { HorloEmailLayout } from './components/HorloEmailLayout'

// D-11: exact hex for --accent token (see HorloEmailLayout.tsx for derivation)
const ACCENT = '#DDA552'

export default function ResetPassword() {
  return (
    <HorloEmailLayout preview="Reset your Horlo password">
      <Section>
        <Heading
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#111111',
            margin: '0 0 12px',
          }}
        >
          Reset your password
        </Heading>
        <Text
          style={{
            fontSize: '15px',
            color: '#444444',
            margin: '0 0 24px',
          }}
        >
          We received a request to reset your Horlo password. Click below to choose a new one.
        </Text>
        {/* D-12: action-specific CTA — Pitfall 7: href must be a plain string literal */}
        <Button
          href="{{ .ConfirmationURL }}"
          style={{
            backgroundColor: ACCENT,
            color: '#FFFFFF',
            padding: '12px 24px',
            borderRadius: '6px',
            fontSize: '15px',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Reset your password
        </Button>
      </Section>
    </HorloEmailLayout>
  )
}
