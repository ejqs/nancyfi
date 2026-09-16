import { defineRelationsPart } from "drizzle-orm"
import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"

import { user } from "@/lib/db/auth-schema"

/** Control-plane roles. Never read/write these from the Automerge doc. */
export const BUDGET_MEMBERSHIP_ROLES = ["owner", "contributor"] as const
export type BudgetMembershipRole = (typeof BUDGET_MEMBERSHIP_ROLES)[number]

export const BUDGET_STATUSES = ["active", "archived"] as const
export type BudgetStatus = (typeof BUDGET_STATUSES)[number]

/**
 * Catalog row for a budget. Content lives in Automerge; this table is for
 * listing, membership, and status (archive) — not CRDT authority.
 */
export const budget = pgTable(
  "budget",
  {
    id: text("id").primaryKey(),
    /** Automerge document URL (e.g. automerge:…). */
    automergeUrl: text("automerge_url").notNull(),
    /** Denormalized display name for lists; CRDT `name` is source for content. */
    name: text("name").notNull(),
    status: text("status").$type<BudgetStatus>().default("active").notNull(),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("budget_createdByUserId_idx").on(table.createdByUserId),
    index("budget_status_idx").on(table.status),
    uniqueIndex("budget_automergeUrl_uidx").on(table.automergeUrl),
  ],
)

/**
 * Links a user to a budget with an authoritative role.
 * Role elevation must only happen via control-plane APIs, never CRDT merge.
 */
export const budgetMembership = pgTable(
  "budget_membership",
  {
    id: text("id").primaryKey(),
    budgetId: text("budget_id")
      .notNull()
      .references(() => budget.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").$type<BudgetMembershipRole>().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("budget_membership_budget_user_uidx").on(
      table.budgetId,
      table.userId,
    ),
    index("budget_membership_userId_idx").on(table.userId),
    index("budget_membership_budgetId_idx").on(table.budgetId),
  ],
)

export const budgetRelations = defineRelationsPart(
  { budget, budgetMembership, user },
  (r) => ({
    budget: {
      createdBy: r.one.user({
        from: r.budget.createdByUserId,
        to: r.user.id,
      }),
      memberships: r.many.budgetMembership({
        from: r.budget.id,
        to: r.budgetMembership.budgetId,
      }),
    },
    budgetMembership: {
      budget: r.one.budget({
        from: r.budgetMembership.budgetId,
        to: r.budget.id,
      }),
      user: r.one.user({
        from: r.budgetMembership.userId,
        to: r.user.id,
      }),
    },
  }),
)
