import * as Automerge from "@automerge/automerge/slim"

import type { BudgetDoc } from "./types"
import {
  applyProposePlanOccurrences,
  type ProposePlanOccurrencesInput,
  type ProposePlanOccurrencesResult,
} from "./plan-propose"
import {
  applySeedCatalogPlanTemplates,
  type SeedCatalogPlanTemplatesInput,
} from "./catalog-plan-templates"

export function proposePlanOccurrences(
  doc: Automerge.Doc<BudgetDoc>,
  input: ProposePlanOccurrencesInput,
): {
  doc: Automerge.Doc<BudgetDoc>
  result: ProposePlanOccurrencesResult
} {
  let result: ProposePlanOccurrencesResult = {
    createdEntryIds: [],
    skippedOccurrenceIds: [],
  }
  const next = Automerge.change(doc, (draft) => {
    result = applyProposePlanOccurrences(draft, input)
  })
  return { doc: next, result }
}

export function seedCatalogPlanTemplates(
  doc: Automerge.Doc<BudgetDoc>,
  input: SeedCatalogPlanTemplatesInput = {},
): {
  doc: Automerge.Doc<BudgetDoc>
  seededIds: string[]
  skippedIds: string[]
} {
  let seededIds: string[] = []
  let skippedIds: string[] = []
  const next = Automerge.change(doc, (draft) => {
    const out = applySeedCatalogPlanTemplates(draft, input)
    seededIds = out.seededIds
    skippedIds = out.skippedIds
  })
  return { doc: next, seededIds, skippedIds }
}
