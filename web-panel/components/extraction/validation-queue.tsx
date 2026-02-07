"use client"

import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Chunk } from "@/lib/types/chunk"

interface ValidationQueueProps {
  chunks: Chunk[]
  allChunks: Chunk[]
  selectedId: string | null
  onSelect: (id: string) => void
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  processed: "default",
  "requires-validation": "secondary",
  processing: "outline",
  "not-processed": "outline",
}

export function ValidationQueue({
  chunks,
  allChunks,
  selectedId,
  onSelect,
}: ValidationQueueProps) {
  const [sourceFilter, setSourceFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const sources = [...new Set(allChunks.map((c) => c.source))]

  const filtered = chunks.filter((c) => {
    if (sourceFilter !== "all" && c.source !== sourceFilter) return false
    if (statusFilter !== "all" && c.status !== statusFilter) return false
    return true
  })

  // Progress: validated (processed) out of total based on data visible in the table (respects source filter)
  const sourceFiltered = chunks.filter((c) => sourceFilter === "all" || c.source === sourceFilter)
  const validatedCount = sourceFiltered.filter((c) => c.status === "processed").length
  const totalCount = sourceFiltered.length
  const progressPercent = totalCount > 0 ? Math.round((validatedCount / totalCount) * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <h3 className="text-sm font-medium">Queue ({filtered.length})</h3>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="not-processed">Not Processed</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="requires-validation">Requires Validation</SelectItem>
            <SelectItem value="processed">Processed</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-3 min-w-[200px]">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {validatedCount}/{totalCount} validated
          </span>
          <Progress value={progressPercent} className="w-[120px]" />
        </div>
      </div>

      <div className="max-h-[300px] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Preview</TableHead>
              <TableHead className="w-36">Status</TableHead>
              <TableHead className="w-32">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-4">
                  No chunks found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((chunk) => (
                <TableRow
                  key={chunk._id}
                  className={`cursor-pointer ${selectedId === chunk._id ? "bg-muted" : ""}`}
                  onClick={() => onSelect(chunk._id)}
                >
                  <TableCell>{chunk.chunkIndex}</TableCell>
                  <TableCell className="truncate max-w-[180px]">{chunk.source}</TableCell>
                  <TableCell className="max-w-[250px] truncate text-muted-foreground">
                    {chunk.content.slice(0, 80)}...
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[chunk.status]}>{chunk.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(chunk.updatedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
