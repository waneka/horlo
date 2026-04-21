import { redirect } from 'next/navigation'

export default async function ProfileIndexPage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  // OUTSIDE try/catch — redirect() throws NEXT_REDIRECT and must propagate.
  redirect(`/u/${username}/collection`)
}
