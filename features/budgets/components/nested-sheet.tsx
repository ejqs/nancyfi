"use client"

import { useMemo } from "react"
import {
  createColumnHelper,
  createExpandedRowModel,
  flexRender,
  rowExpandingFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { NestedSheetRow } from "../sheets"
import { StatusDot } from "./list-row"

const sheetFeatures = tableFeatures({
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
})

const columnHelper = createColumnHelper<typeof sheetFeatures, NestedSheetRow>()

type NestedSheetTableProps = {
  rows: NestedSheetRow[]
  emptyLabel: string
  onConfirmEntry?: (entryId: string) => void
  onConfirmGroup?: (row: NestedSheetRow) => void
  onOpenPlan?: (planId: string) => void
}

export function NestedSheetTable({
  rows,
  emptyLabel,
  onConfirmEntry,
  onConfirmGroup,
  onOpenPlan,
}: NestedSheetTableProps) {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "title",
          header: "Name",
          cell: ({ row }) => {
            const item = row.original
            const canExpand = row.getCanExpand()
            return (
              <div
                className="flex min-w-0 items-center gap-1.5"
                style={{ paddingLeft: row.depth * 16 }}
              >
                {canExpand ? (
                  <button
                    type="button"
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    onClick={row.getToggleExpandedHandler()}
                    aria-expanded={row.getIsExpanded()}
                    aria-label={
                      row.getIsExpanded()
                        ? `Collapse ${item.title}`
                        : `Expand ${item.title}`
                    }
                  >
                    <ChevronRight
                      className={cn(
                        "size-3.5 transition-transform",
                        row.getIsExpanded() && "rotate-90",
                      )}
                    />
                  </button>
                ) : (
                  <span className="size-6 shrink-0" />
                )}
                <StatusDot tone={item.statusTone} label={item.statusLabel} />
                <span className="min-w-0 truncate font-medium">{item.title}</span>
              </div>
            )
          },
        }),
        columnHelper.accessor("amountLabel", {
          header: "Amount",
          cell: ({ getValue }) => (
            <span className="tabular-nums text-muted-foreground">
              {getValue()}
            </span>
          ),
        }),
        columnHelper.accessor("statusLabel", {
          header: "Status",
          cell: ({ getValue }) => (
            <span className="text-xs text-muted-foreground">{getValue()}</span>
          ),
        }),
        columnHelper.accessor("meta", {
          header: "Detail",
          cell: ({ getValue }) => (
            <span className="text-xs text-muted-foreground">{getValue()}</span>
          ),
        }),
        columnHelper.display({
          id: "actions",
          header: "",
          cell: ({ row }) => {
            const item = row.original
            const confirmChild =
              item.canConfirm && item.entryId && item.children.length === 0
            const confirmGroup =
              item.canConfirm && item.children.some((child) => child.canConfirm)
            return (
              <div className="flex justify-end gap-1">
                {item.planId && onOpenPlan ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onOpenPlan(item.planId!)}
                  >
                    Edit
                  </Button>
                ) : null}
                {confirmGroup && onConfirmGroup ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onConfirmGroup(item)}
                  >
                    Confirm all
                  </Button>
                ) : null}
                {confirmChild && onConfirmEntry && item.entryId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onConfirmEntry(item.entryId!)}
                  >
                    Confirm
                  </Button>
                ) : null}
              </div>
            )
          },
        }),
      ]),
    [onConfirmEntry, onConfirmGroup, onOpenPlan],
  )

  const table = useTable(
    {
      features: sheetFeatures,
      data: rows,
      columns,
      getRowId: (row) => row.id,
      getSubRows: (row) => (row.children.length > 0 ? row.children : undefined),
    },
    (state) => ({ expanded: state.expanded }),
  )

  if (rows.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border/80">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id} className="border-b border-border/80">
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  className="px-2 py-1.5 text-left text-[0.65rem] font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-border/60 last:border-b-0 hover:bg-muted/40"
            >
              {row.getAllCells().map((cell) => (
                <td key={cell.id} className="px-2 py-1.5 align-middle">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
