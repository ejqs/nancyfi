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
  showRemaining?: boolean
  onAddChild?: (parentEntryId: string) => void
}

export function NestedSheetTable({
  rows,
  emptyLabel,
  showRemaining = false,
  onAddChild,
}: NestedSheetTableProps) {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.display({
          id: "title",
          header: "Item",
          cell: ({ row }) => {
            const item = row.original
            const canExpand = row.getCanExpand()
            return (
              <div
                className="flex min-w-0 items-center gap-1"
                style={{ paddingLeft: row.depth * 16 }}
              >
                {canExpand ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-expanded={row.getIsExpanded()}
                    aria-label={
                      row.getIsExpanded()
                        ? `Collapse ${item.title}`
                        : `Expand ${item.title}`
                    }
                    onClick={row.getToggleExpandedHandler()}
                  >
                    <ChevronRight
                      className={cn(
                        "transition-transform",
                        row.getIsExpanded() && "rotate-90",
                      )}
                    />
                  </Button>
                ) : (
                  <span className="inline-flex size-5 shrink-0" />
                )}
                <StatusDot tone={item.statusTone} label={item.statusLabel} />
                <span className="truncate font-medium">{item.title}</span>
              </div>
            )
          },
        }),
        columnHelper.accessor("amountLabel", {
          header: showRemaining ? "Debit" : "Amount",
          cell: ({ getValue }) => (
            <span className="block text-right tabular-nums text-muted-foreground">
              {getValue()}
            </span>
          ),
        }),
        ...(showRemaining
          ? [
              columnHelper.accessor("remainingLabel", {
                header: "Remaining",
                cell: ({ getValue }) => (
                  <span className="block text-right tabular-nums">
                    {getValue() ?? "—"}
                  </span>
                ),
              }),
            ]
          : []),
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
            if (!onAddChild || !item.entryId || row.depth > 0) return null
            return (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => onAddChild(item.entryId!)}
              >
                Nest repayment
              </Button>
            )
          },
        }),
      ]),
    [onAddChild, showRemaining],
  )

  const table = useTable({
    features: sheetFeatures,
    data: rows,
    columns,
    getRowId: (row) => row.id,
    getSubRows: (row) => (row.children.length > 0 ? row.children : undefined),
    autoResetExpanded: false,
  })

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
                <td key={cell.id} className="px-2 py-1 align-middle">
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
