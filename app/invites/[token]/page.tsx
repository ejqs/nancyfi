import { InviteAcceptClient } from "@/features/budgets/components/invite-accept-client"
import { getInviteByToken } from "@/features/budgets/db/invites"
import { emailsMatch } from "@/features/budgets/invite-rules"
import { getCurrentUser } from "@/lib/session"
import { notFound } from "next/navigation"

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const invite = await getInviteByToken(token)
  if (!invite) {
    notFound()
  }

  const user = await getCurrentUser()
  const signedInEmail = user?.email ?? null
  const emailMatches = signedInEmail
    ? emailsMatch(signedInEmail, invite.email)
    : false

  return (
    <InviteAcceptClient
      token={token}
      budgetName={invite.budgetName}
      invitedEmail={invite.email}
      status={invite.status}
      signedIn={!!user}
      signedInEmail={signedInEmail}
      emailMatches={emailMatches}
    />
  )
}
