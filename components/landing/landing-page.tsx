import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

const pillars = [
  {
    title: "Simple",
    body: "Few concepts to learn. Clear primary actions and sensible defaults.",
  },
  {
    title: "Flexible",
    body: "Shape budgets to your life without fighting the tool.",
  },
  {
    title: "Offline-first",
    body: "Your local copy is primary. Sync when a network is available.",
  },
] as const

export function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Nancyfi
        </Link>
        <div className="flex items-center gap-2">
          <Button
            render={<Link href="/sign-in" />}
            nativeButton={false}
            variant="ghost"
            size="sm"
          >
            Sign in
          </Button>
          <Button
            render={<Link href="/sign-up" />}
            nativeButton={false}
            size="sm"
          >
            Get started
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 pb-20">
        <section className="flex min-h-[70vh] flex-col justify-center gap-8 py-16">
          <div className="flex max-w-2xl flex-col gap-4">
            <p className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Nancyfi
            </p>
            <h1 className="max-w-xl text-2xl font-medium tracking-tight text-balance sm:text-3xl">
              Budgeting as simple as possible, yet as flexible as possible.
            </h1>
            <p className="max-w-lg text-base text-muted-foreground text-pretty">
              One responsive website for budgets you can edit offline, share
              with others, and grow without clutter.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              render={<Link href="/sign-up" />}
              nativeButton={false}
              size="lg"
            >
              Get started
            </Button>
            <Button
              render={<Link href="/sign-in" />}
              nativeButton={false}
              variant="secondary"
              size="lg"
            >
              Sign in
            </Button>
          </div>
        </section>

        <Separator />

        <section className="flex flex-col gap-8 py-16">
          <div className="flex max-w-xl flex-col gap-2">
            <h2 className="text-xl font-medium tracking-tight">
              Built around how people actually budget
            </h2>
            <p className="text-sm text-muted-foreground text-pretty">
              Start with the essentials. Power stays available without being
              required up front.
            </p>
          </div>
          <div className="grid gap-8 sm:grid-cols-3">
            {pillars.map((pillar) => (
              <div key={pillar.title} className="flex flex-col gap-2">
                <h3 className="text-sm font-medium">{pillar.title}</h3>
                <p className="text-sm text-muted-foreground text-pretty">
                  {pillar.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
