"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import {
  USER_ACCOUNT_RESET_CONFIRMATION,
} from "../account-reset"
import { resetUserAccountAction } from "../actions"
import {
  LOCAL_BUDGET_URL_KEY,
} from "../repo/budget-handles"
import { clearBrowserAutomergeStorage } from "../repo/create-browser-repo"

type AccountResetPanelProps = {
  onResetComplete?: () => void
}

export function AccountResetPanel({ onResetComplete }: AccountResetPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReset(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const result = await resetUserAccountAction({ confirmation })
      if (!result.ok) {
        setError(result.error)
        return
      }

      try {
        for (const key of Object.keys(window.localStorage)) {
          if (
            key === LOCAL_BUDGET_URL_KEY ||
            key.startsWith("nancyfi:") ||
            key.startsWith("nancyfi.")
          ) {
            window.localStorage.removeItem(key)
          }
        }
        await clearBrowserAutomergeStorage()
      } catch {
        // Control plane already reset; local clear is best-effort.
      }

      setOpen(false)
      setConfirmation("")
      onResetComplete?.()
      router.refresh()
      window.location.assign("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset account")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <div>
        <h2 className="text-sm font-medium text-foreground">Account</h2>
        <p className="text-xs text-muted-foreground">
          Permanently delete your budgets and leave every shared one. Your
          sign-in stays.
        </p>
      </div>

      {!open ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setOpen(true)
              setError(null)
              setConfirmation("")
            }}
          >
            Reset account to 0
          </Button>
        </div>
      ) : (
        <form
          onSubmit={handleReset}
          className="flex flex-col gap-3 rounded-md border border-border p-3"
        >
          <p className="text-xs text-muted-foreground">
            This permanently deletes budgets you solely own (and their invites /
            memberships), removes you from every other budget, cancels your
            pending invites, and clears local data. Type{" "}
            <span className="font-medium text-foreground">
              {USER_ACCOUNT_RESET_CONFIRMATION}
            </span>{" "}
            to confirm.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account-reset-confirm">Confirmation</Label>
            <Input
              id="account-reset-confirm"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              placeholder={USER_ACCOUNT_RESET_CONFIRMATION}
              disabled={busy}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="destructive" size="sm" disabled={busy}>
              {busy ? "Resetting…" : "Reset account"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                setConfirmation("")
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      )}
    </section>
  )
}
