import { config } from "dotenv"
import { defineConfig } from "drizzle-kit"

config({ path: ".env.local" })
config()

export default defineConfig({
  schema: ["./lib/db/auth-schema.ts", "./features/budgets/db/schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
