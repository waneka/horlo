'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function SignupForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signupSent, setSignupSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { data, error: err } = await supabase.auth.signUp({ email, password })
    if (err) {
      // Neutral copy — no user enumeration (don't leak whether email is already registered)
      setError('Could not create account.')
      setLoading(false)
      return
    }
    if (!data.session) {
      // D-10: When Confirm-email is ON, signUp returns no session until the email link is clicked.
      setSignupSent(true)
      setLoading(false)
      return
    }
    // Immediate session (Confirm-email OFF — preserved for backward safety / staging).
    router.push('/')
    router.refresh()
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Create your Horlo account</CardTitle>
      </CardHeader>
      {!signupSent ? (
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
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="hover:text-foreground underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      ) : (
        <>
          <CardContent className="space-y-3">
            <p className="text-sm">Check your email to confirm your account.</p>
            <p className="text-muted-foreground text-sm">Confirmation sent to {email}.</p>
          </CardContent>
          <CardFooter>
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="hover:text-foreground underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </>
      )}
    </Card>
  )
}
