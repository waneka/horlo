'use client'
import { useState } from 'react'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.resetPasswordForEmail(email, {
      // Land directly on /reset-password after Supabase's verify endpoint sets the recovery session.
      // Path-only URL (no query string) sidesteps allowlist matching nuances; /auth/callback
      // expects token_hash which Supabase's verify flow does not pass through to the redirect target.
      redirectTo: `${window.location.origin}/reset-password`,
    })
    // Always show the same success state regardless of whether the email exists (no enumeration)
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Check your inbox</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            If an account exists for that email, a reset link has been sent.
          </p>
        </CardContent>
        <CardFooter>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </CardFooter>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Reset your password</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Sending\u2026' : 'Send reset link'}
          </Button>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Back to sign in
          </Link>
        </CardFooter>
      </form>
    </Card>
  )
}
