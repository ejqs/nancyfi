import { DashboardGate } from "@/components/landing/dashboard-gate"
import { LandingPage } from "@/components/landing/landing-page"
import { getCurrentUser } from "@/lib/session"

export default async function HomePage() {
  const user = await getCurrentUser()

  if (user) {
    return <DashboardGate name={user.name} email={user.email} />
  }

  return <LandingPage />
}
