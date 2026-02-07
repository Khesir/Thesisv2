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
import { Checkbox } from "@/components/ui/checkbox"
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

interface ChunkSelectorProps {
  chunks: Chunk[]
  allChunks: Chunk[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  processed: "default",
  "requires-validation": "secondary",
  processing: "outline",
  "not-processed": "outline",
}

export function ChunkSelector({
  chunks,
  allChunks,
  selectedIds,
  onSelectionChange,
}: ChunkSelectorProps) {
  const [sourceFilter, setSourceFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const sources = [...new Set(allChunks.map((c) => c.source))]

  const filtered = chunks.filter((c) => {
    if (sourceFilter !== "all" && c.source !== sourceFilter) return false
    if (statusFilter !== "all" && c.status !== statusFilter) return false
    return true
  })

  // Progress: processed out of total based on data visible in the table (respects source filter)
  const sourceFiltered = chunks.filter((c) => sourceFilter === "all" || c.source === sourceFilter)
  const processedCount = sourceFiltered.filter((c) => c.status === "processed").length
  const totalCount = sourceFiltered.length
  const progressPercent = totalCount > 0 ? Math.round((processedCount / totalCount) * 100) : 0

  const allSelected = filtered.length > 0 && filtered.every((c) => selectedIds.includes(c._id))

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => !filtered.some((c) => c._id === id)))
    } else {
      const newIds = new Set(selectedIds)
      filtered.forEach((c) => newIds.add(c._id))
      onSelectionChange([...newIds])
    }
  }

  const toggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id))
    } else {
      onSelectionChange([...selectedIds, id])
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
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
            {processedCount}/{totalCount} processed
          </span>
          <Progress value={progressPercent} className="w-[120px]" />
        </div>
      </div>

      <div className="max-h-[400px] overflow-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Preview</TableHead>
              <TableHead className="w-20">Tokens</TableHead>
              <TableHead className="w-36">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                  No chunks available
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((chunk) => (
                <TableRow key={chunk._id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(chunk._id)}
                      onCheckedChange={() => toggleOne(chunk._id)}
                    />
                  </TableCell>
                  <TableCell>{chunk.chunkIndex}</TableCell>
                  <TableCell className="truncate max-w-[180px]">{chunk.source}</TableCell>
                  <TableCell className="max-w-[250px] truncate text-muted-foreground">
                    {chunk.content.slice(0, 80)}...
                  </TableCell>
                  <TableCell>{chunk.tokenCount}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[chunk.status]}>{chunk.status}</Badge>
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
