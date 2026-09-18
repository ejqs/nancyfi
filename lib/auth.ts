import { betterAuth } from "better-auth"
import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2"
import { nextCookies } from "better-auth/next-js"

import { db } from "@/lib/db"
import * as schema from "@/schema/auth-schema"
import { sendEmail } from "@/lib/email"

export const auth = betterAuth({
  appName: "Nancyfi",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    revokeSessionsOnPasswordReset: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: "Reset your Nancyfi password",
        text: `Click the link to reset your password: ${url}`,
        html: `<p>Click the link to reset your password:</p><p><a href="${url}">${url}</a></p>`,
        idempotencyKey: `password-reset/${user.id}/${Date.now()}`,
      })
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Verify your Nancyfi email",
        text: `Click the link to verify your email: ${url}`,
        html: `<p>Click the link to verify your email:</p><p><a href="${url}">${url}</a></p>`,
        idempotencyKey: `email-verify/${user.id}/${Date.now()}`,
      })
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    storage: "database",
  },
  plugins: [nextCookies()],
})

export type Session = typeof auth.$Infer.Session
