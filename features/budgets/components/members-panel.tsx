"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import {
  cancelBudgetInviteAction,
  createBudgetInviteAction,
  leaveBudgetAction,
  listBudgetMembersAction,
  listPendingInvitesAction,
  revokeBudgetMemberAction,
  type BudgetInviteItem,
  type BudgetMemberItem,
} from "../actions"
import type { BudgetMembershipRole } from "../db/schema"

type MembersPanelProps = {
  budgetId: string
  role: BudgetMembershipRole
  currentUserId?: string
}

export function MembersPanel({
  budgetId,
  role,
  currentUserId,
}: MembersPanelProps) {
  const router = useRouter()
  const [members, setMembers] = useState<BudgetMemberItem[]>([])
  const [invites, setInvites] = useState<BudgetInviteItem[]>([])
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const isOwner = role === "owner"

  async function refresh() {
    const membersResult = await listBudgetMembersAction(budgetId)
    if (!membersResult.ok) {
      setError(membersResult.error)
      setMembers([])
    } else {
      setMembers(membersResult.data)
    }

    if (isOwner) {
      const invitesResult = await listPendingInvitesAction(budgetId)
      if (!invitesResult.ok) {
        setError(invitesResult.error)
        setInvites([])
      } else {
        setInvites(invitesResult.data)
      }
    } else {
      setInvites([])
    }
  }

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      await refresh()
      if (!cancelled) setLoading(false)
    }
    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when budget/role changes
  }, [budgetId, isOwner])

  function handleInvite(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await createBudgetInviteAction({
        budgetId,
        email,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setEmail("")
      if (result.data.emailSent) {
        setNotice(`Invite sent to ${result.data.email}.`)
      } else {
        setNotice(
          `Invite created for ${result.data.email}. Email was not sent${
            result.data.emailError ? ` (${result.data.emailError})` : ""
          }. Copy the link from pending invites below.`,
        )
      }
      await refresh()
    })
  }

  function handleCancelInvite(inviteId: string) {
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await cancelBudgetInviteAction({ inviteId, budgetId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      await refresh()
    })
  }

  async function handleCopyInvite(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setNotice("Invite link copied.")
      setError(null)
    } catch {
      setError("Could not copy link. Select it manually.")
    }
  }

  function handleRevoke(targetUserId: string, name: string) {
    if (
      !window.confirm(
        `Remove ${name} from this budget? They will lose access immediately.`,
      )
    ) {
      return
    }
    setError(null)
    setNotice(null)
    startTransition(async () => {
      const result = await revokeBudgetMemberAction({ budgetId, targetUserId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      await refresh()
    })
  }

  function handleLeave() {
    if (
      !window.confirm(
        "Leave this budget? You will lose access until invited again.",
      )
    ) {
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await leaveBudgetAction({ budgetId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push("/")
      router.refresh()
    })
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-medium text-foreground">People</h2>
        <p className="text-xs text-muted-foreground">
          Invite people to edit this budget with you.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading members…</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {members.map((member) => {
            const isSelf = currentUserId
              ? member.userId === currentUserId
              : false
            return (
              <li
                key={member.membershipId}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {member.name}
                    {isSelf ? " (you)" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {member.email} · {member.role}
                  </p>
                </div>
                {isOwner && member.role === "contributor" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() => handleRevoke(member.userId, member.name)}
                  >
                    Revoke
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {isOwner ? (
        <>
          <form
            onSubmit={handleInvite}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="invite-email">Invite by email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
                disabled={pending}
                required
                autoComplete="email"
              />
            </div>
            <Button type="submit" disabled={pending || !email.trim()}>
              Send invite
            </Button>
          </form>

          {invites.length > 0 ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-foreground">
                Pending invites
              </p>
              <ul className="flex flex-col gap-2">
                {invites.map((invite) => (
                  <li
                    key={invite.id}
                    className="flex flex-wrap items-center justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <p>{invite.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Link ready to share
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => void handleCopyInvite(invite.acceptUrl)}
                      >
                        Copy link
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleCancelInvite(invite.id)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      {role === "contributor" ||
      (role === "owner" && members.filter((m) => m.role === "owner").length > 1) ? (
        <div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={handleLeave}
          >
            Leave budget
          </Button>
        </div>
      ) : null}

      {notice ? (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
