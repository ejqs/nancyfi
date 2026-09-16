import { Resend } from "resend"

type SendEmailInput = {
  to: string
  subject: string
  html: string
  text: string
  idempotencyKey: string
}

function getResend() {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set")
  }
  return new Resend(apiKey)
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  idempotencyKey,
}: SendEmailInput) {
  const from =
    process.env.EMAIL_FROM?.trim() ?? "Nancyfi <noreply@nancyfi.app>"

  const { data, error } = await getResend().emails.send(
    {
      from,
      to: [to],
      subject,
      html,
      text,
    },
    { idempotencyKey }
  )

  if (error) {
    console.error("Failed to send email:", error.message)
    throw new Error(error.message)
  }

  return data
}
