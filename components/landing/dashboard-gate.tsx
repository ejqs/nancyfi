"use client"

import dynamic from "next/dynamic"

const Dashboard = dynamic(
  () =>
    import("@/components/landing/dashboard").then((mod) => mod.Dashboard),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
        Loading your workspace…
      </div>
    ),
  },
)

export function DashboardGate({
  name,
  email,
}: {
  name: string
  email: string
}) {
  return <Dashboard name={name} email={email} />
}
