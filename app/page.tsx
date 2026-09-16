import { Dashboard } from "@/components/landing/dashboard"
import { LandingPage } from "@/components/landing/landing-page"
import { getSession } from "@/lib/session"

export default async function HomePage() {
  const session = await getSession()

  if (session?.user) {
    return (
      <Dashboard name={session.user.name} email={session.user.email} />
    )
  }

  return <LandingPage />
}
