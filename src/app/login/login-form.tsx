'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(
    initialError === 'invalid_link' ? 'That link is invalid or expired.' : null,
  )
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createSupabaseBrowserClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) {
      // Neutral copy — no user enumeration
      setError('Invalid email or password.')
      setLoading(false)
      return
    }
    router.push(next)
    router.refresh()
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="font-serif text-2xl">Sign in to Horlo</CardTitle>
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
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Signing in\u2026' : 'Sign in'}
          </Button>
          <div className="flex w-full justify-between text-sm text-muted-foreground">
            <Link href="/signup" className="hover:text-foreground">
              Create account
            </Link>
            <Link href="/forgot-password" className="hover:text-foreground">
              Forgot password?
            </Link>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}
