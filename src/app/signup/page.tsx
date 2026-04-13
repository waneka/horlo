import { SignupForm } from './signup-form'

export default async function SignupPage() {
  return (
    <div className="flex min-h-[calc(100svh-4rem)] items-center justify-center px-4">
      <SignupForm />
    </div>
  )
}
