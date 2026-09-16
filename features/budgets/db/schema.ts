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

/** Control-plane invite lifecycle. Never authorize from the Automerge doc. */
export const BUDGET_INVITE_STATUSES = [
  "pending",
  "accepted",
  "cancelled",
  "expired",
] as const
export type BudgetInviteStatus = (typeof BUDGET_INVITE_STATUSES)[number]

/** Invites always grant contributor — no client-supplied role. */
export const BUDGET_INVITE_ROLE = "contributor" as const

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

/**
 * Pending (or historical) invitation to join a budget as contributor.
 * Acceptance is online-only via control-plane APIs + matching signed-in email.
 */
export const budgetInvite = pgTable(
  "budget_invite",
  {
    id: text("id").primaryKey(),
    budgetId: text("budget_id")
      .notNull()
      .references(() => budget.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    /** Opaque accept token used in `/invites/[token]`. */
    token: text("token").notNull(),
    role: text("role")
      .$type<typeof BUDGET_INVITE_ROLE>()
      .default(BUDGET_INVITE_ROLE)
      .notNull(),
    status: text("status").$type<BudgetInviteStatus>().notNull(),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    acceptedByUserId: text("accepted_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at").notNull(),
    acceptedAt: timestamp("accepted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("budget_invite_token_uidx").on(table.token),
    index("budget_invite_budgetId_idx").on(table.budgetId),
    index("budget_invite_email_idx").on(table.email),
    index("budget_invite_status_idx").on(table.status),
  ],
)

export const budgetRelations = defineRelationsPart(
  { budget, budgetMembership, budgetInvite, user },
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
      invites: r.many.budgetInvite({
        from: r.budget.id,
        to: r.budgetInvite.budgetId,
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
    budgetInvite: {
      budget: r.one.budget({
        from: r.budgetInvite.budgetId,
        to: r.budget.id,
      }),
      invitedBy: r.one.user({
        from: r.budgetInvite.invitedByUserId,
        to: r.user.id,
      }),
      acceptedBy: r.one.user({
        from: r.budgetInvite.acceptedByUserId,
        to: r.user.id,
      }),
    },
  }),
)
