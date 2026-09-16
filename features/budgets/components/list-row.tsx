import { cn } from "@/lib/utils"

export function ListRow({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}) {
  const interactive = Boolean(onClick)
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
      className={cn(
        "flex min-h-9 flex-wrap items-center gap-2 border-b border-border/60 px-1 py-1.5 text-sm last:border-b-0",
        interactive && "cursor-pointer hover:bg-muted/50",
        className,
      )}
    >
      {children}
    </div>
  )
}

export function StatusDot({
  tone,
  label,
}: {
  tone: "proposed" | "posted" | "void" | "active" | "muted"
  label: string
}) {
  const color =
    tone === "proposed"
      ? "bg-amber-500"
      : tone === "posted" || tone === "active"
        ? "bg-emerald-600"
        : tone === "void"
          ? "bg-muted-foreground/50"
          : "bg-muted-foreground/40"
  return (
    <span
      className={cn("size-1.5 shrink-0 rounded-full", color)}
      title={label}
      aria-label={label}
    />
  )
}

export function RowTitle({ children }: { children: React.ReactNode }) {
  return (
    <span className="min-w-0 flex-1 truncate font-medium text-foreground">
      {children}
    </span>
  )
}

export function RowMeta({ children }: { children: React.ReactNode }) {
  return (
    <span className="order-last w-full truncate pl-3 text-xs text-muted-foreground sm:order-none sm:w-auto sm:max-w-[60%] sm:shrink-0 sm:pl-0">
      {children}
    </span>
  )
}

export function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="flex shrink-0 items-center gap-1">{children}</div>
}
