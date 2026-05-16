/**
 * Change email address email template.
 *
 * D-12: CTA copy is action-specific — "Confirm email change"
 * D-11: All colors are hex literals; the ACCENT constant is the exact conversion.
 *
 * The {{ .ConfirmationURL }} token is a literal Go-template string substituted
 * by Supabase GoTrue at send time. It must survive react-email export verbatim.
 */
import { Section, Heading, Text, Button } from '@react-email/components'
import { HorloEmailLayout } from './components/HorloEmailLayout'

// D-11: exact hex for --accent token (see HorloEmailLayout.tsx for derivation)
const ACCENT = '#DDA552'

export default function ChangeEmail() {
  return (
    <HorloEmailLayout preview="Confirm your new Horlo email address">
      <Section>
        <Heading
          style={{
            fontSize: '20px',
            fontWeight: 600,
            color: '#111111',
            margin: '0 0 12px',
          }}
        >
          Confirm your new email
        </Heading>
        <Text
          style={{
            fontSize: '15px',
            color: '#444444',
            margin: '0 0 24px',
          }}
        >
          Confirm this address to finish changing the email on your Horlo account.
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
          Confirm email change
        </Button>
      </Section>
    </HorloEmailLayout>
  )
}
