"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type AppShellBudgetLink = {
  id: string
  name: string
  href: string
  active?: boolean
}

export type AppShellNavItem = {
  id: string
  label: string
  onSelect: () => void
  active?: boolean
}

type AppShellProps = {
  title?: string
  subtitle?: string
  budgets?: AppShellBudgetLink[]
  sectionNav?: AppShellNavItem[]
  headerActions?: React.ReactNode
  children: React.ReactNode
}

export function AppShell({
  title,
  subtitle,
  budgets,
  sectionNav,
  headerActions,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const sidebar = (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link
        href="/"
        className="text-sm font-semibold tracking-tight"
        onClick={() => setMobileOpen(false)}
      >
        Nancyfi
      </Link>

      {budgets ? (
        <div className="flex flex-col gap-1">
          <p className="px-2 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
            Budgets
          </p>
          <ul className="flex flex-col gap-0.5">
            {budgets.length === 0 ? (
              <li className="px-2 py-1 text-xs text-muted-foreground">
                No budgets yet
              </li>
            ) : (
              budgets.map((budget) => (
                <li key={budget.id}>
                  <Link
                    href={budget.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "block rounded-md px-2 py-1.5 text-sm",
                      budget.active
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    {budget.name}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {sectionNav && sectionNav.length > 0 ? (
        <div className="flex flex-col gap-1">
          <p className="px-2 text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase">
            Views
          </p>
          <ul className="flex flex-col gap-0.5">
            {sectionNav.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    item.onSelect()
                    setMobileOpen(false)
                  }}
                  className={cn(
                    "w-full rounded-md px-2 py-1.5 text-left text-sm",
                    item.active
                      ? "bg-muted font-medium text-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="flex min-h-full flex-1">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-background md:block">
        {sidebar}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-background/70"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-border bg-background shadow-sm">
            <div className="flex items-center justify-end p-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <X />
              </Button>
            </div>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu />
            </Button>
            <div className="min-w-0">
              {title ? (
                <h1 className="truncate text-sm font-semibold tracking-tight">
                  {title}
                </h1>
              ) : (
                <p className="text-sm font-semibold tracking-tight md:hidden">
                  Nancyfi
                </p>
              )}
              {subtitle ? (
                <p className="truncate text-xs text-muted-foreground">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
        </header>
        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-16 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  )
}
