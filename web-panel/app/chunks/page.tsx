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
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Eye, ArrowUpDown } from "lucide-react"
import { useChunks, useSources } from "@/lib/hooks/use-api"
import { Chunk } from "@/lib/types/chunk"
import { Skeleton } from "@/components/ui/skeleton"

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  processed: "default",
  "requires-validation": "secondary",
  processing: "outline",
  "not-processed": "outline",
}

export default function ChunksPage() {
  const [search, setSearch] = useState("")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")
  const [detailChunk, setDetailChunk] = useState<Chunk | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data: sourcesData } = useSources()
  const sources = sourcesData?.sources || []

  const { data, isLoading } = useChunks({
    status: statusFilter,
    source: sourceFilter,
    search: search || undefined,
    sort: sortOrder,
    page,
    limit: pageSize,
  })

  const chunks = data?.chunks || []
  const total = data?.total || 0
  const totalPages = data?.totalPages || 1

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Chunks</h1>

      <div className="flex flex-wrap gap-4">
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1) }}>
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

        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1) }}>
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
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="w-[200px]"
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() => setSortOrder((s) => s === "desc" ? "asc" : "desc")}
          className="ml-auto"
        >
          <ArrowUpDown className="mr-2 h-4 w-4" />
          {sortOrder === "desc" ? "Recent first" : "Oldest first"}
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Preview</TableHead>
                <TableHead className="w-20">Tokens</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="w-32">Created</TableHead>
                <TableHead className="w-16">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {chunks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No chunks found
                  </TableCell>
                </TableRow>
              ) : (
                chunks.map((chunk) => (
                  <TableRow key={chunk._id}>
                    <TableCell>{chunk.chunkIndex}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{chunk.source}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-muted-foreground">
                      {chunk.content.slice(0, 80)}...
                    </TableCell>
                    <TableCell>{chunk.tokenCount}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[chunk.status]}>{chunk.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(chunk.createdAt).toLocaleDateString()}
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
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} chunk{total !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Page {page} of {Math.max(totalPages, 1)}
          </p>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
            Next
          </Button>
        </div>
      </div>

      {detailChunk && (
        <Dialog open={!!detailChunk} onOpenChange={(open) => !open && setDetailChunk(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Chunk #{detailChunk.chunkIndex} - {detailChunk.source}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <Badge variant={statusVariant[detailChunk.status]}>{detailChunk.status}</Badge>
                </div>
                <div>
                  <span className="text-muted-foreground">Tokens: </span>
                  <span className="font-medium">{detailChunk.tokenCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Created: </span>
                  <span>{new Date(detailChunk.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              <ScrollArea className="h-[400px] rounded-md border p-4">
                <pre className="whitespace-pre-wrap text-sm">{detailChunk.content}</pre>
              </ScrollArea>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
