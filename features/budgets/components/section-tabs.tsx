"use client"

import { cn } from "@/lib/utils"

export type WorkspaceSection =
  | "home"
  | "payday"
  | "recurring"
  | "transactions"

const SECTIONS: { id: WorkspaceSection; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "payday", label: "Payday" },
  { id: "recurring", label: "Recurring" },
  { id: "transactions", label: "Transactions" },
]

export function SectionTabs({
  value,
  onChange,
  className,
}: {
  value: WorkspaceSection
  onChange: (section: WorkspaceSection) => void
  className?: string
}) {
  return (
    <nav
      aria-label="Budget sections"
      className={cn(
        "-mx-1 flex gap-0.5 overflow-x-auto border-b border-border pb-px",
        className,
      )}
    >
      {SECTIONS.map((section) => {
        const active = section.id === value
        return (
          <button
            key={section.id}
            type="button"
            onClick={() => onChange(section.id)}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {section.label}
          </button>
        )
      })}
    </nav>
  )
}

export { SECTIONS as WORKSPACE_SECTIONS }
