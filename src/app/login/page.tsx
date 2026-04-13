import { LoginForm } from './login-form'

type PageProps = {
  searchParams: Promise<{ next?: string; error?: string }>
}

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams
  const nextParam = typeof params.next === 'string' ? params.next : '/'
  // Guard against open-redirect: only allow same-origin relative paths
  const safeNext = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/'
  return (
    <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center px-4">
      <LoginForm next={safeNext} initialError={params.error} />
    </div>
  )
}
