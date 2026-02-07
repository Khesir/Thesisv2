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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Eye, ArrowUpDown } from "lucide-react"
import { Chunk } from "@/lib/types/chunk"
import { ChunkDetailDialog } from "./chunk-detail-dialog"

interface ChunksTableProps {
  chunks: Chunk[]
  selectedIds: string[]
  onSelectionChange: (ids: string[]) => void
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  processed: "default",
  "requires-validation": "secondary",
  processing: "outline",
  "not-processed": "outline",
}

export function ChunksTable({
  chunks,
  selectedIds,
  onSelectionChange,
}: ChunksTableProps) {
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [detailChunk, setDetailChunk] = useState<Chunk | null>(null)
  const [sortOrder, setSortOrder] = useState<"recent" | "oldest">("recent")
  const [page, setPage] = useState(0)
  const pageSize = 10

  const sources = [...new Set(chunks.map((c) => c.source))]

  const filtered = chunks
    .filter((c) => {
      if (sourceFilter !== "all" && c.source !== sourceFilter) return false
      if (statusFilter !== "all" && c.status !== statusFilter) return false
      if (search && !c.content.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
    .sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime()
      const bTime = new Date(b.createdAt).getTime()
      return sortOrder === "recent" ? bTime - aTime : aTime - bTime
    })

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize)

  const allSelected = paged.length > 0 && paged.every((c) => selectedIds.includes(c._id))

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange(selectedIds.filter((id) => !paged.some((c) => c._id === id)))
    } else {
      const newIds = new Set(selectedIds)
      paged.forEach((c) => newIds.add(c._id))
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
      <div className="flex flex-wrap gap-4">
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(0) }}>
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

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0) }}>
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

        <Input
          placeholder="Search content..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          className="w-[200px]"
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder((s) => s === "recent" ? "oldest" : "recent")}
          className="ml-auto"
        >
          <ArrowUpDown className="mr-2 h-4 w-4" />
          {sortOrder === "recent" ? "Recent first" : "Oldest first"}
        </Button>
      </div>

      <div className="rounded-md border">
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
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No chunks found
                </TableCell>
              </TableRow>
            ) : (
              paged.map((chunk) => (
                <TableRow key={chunk._id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.includes(chunk._id)}
                      onCheckedChange={() => toggleOne(chunk._id)}
                    />
                  </TableCell>
                  <TableCell>{chunk.chunkIndex}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{chunk.source}</TableCell>
                  <TableCell className="max-w-[300px] truncate text-muted-foreground">
                    {chunk.content.slice(0, 80)}...
                  </TableCell>
                  <TableCell>{chunk.tokenCount}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[chunk.status]}>{chunk.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setDetailChunk(chunk)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Selected: {selectedIds.length}</p>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Page {page + 1} of {Math.max(totalPages, 1)}
          </p>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
            Next
          </Button>
        </div>
      </div>

      <ChunkDetailDialog
        chunk={detailChunk}
        open={!!detailChunk}
        onOpenChange={(open) => !open && setDetailChunk(null)}
      />
    </div>
  )
}
