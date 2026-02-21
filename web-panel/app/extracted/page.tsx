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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, ArrowUpDown } from "lucide-react"
import { useExtractedData, useSources } from "@/lib/hooks/use-api"
import { Skeleton } from "@/components/ui/skeleton"

interface PopulatedChunk {
  _id: string
  source: string
  chunkIndex: number
}

export default function ExtractedDataPage() {
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")
  const [detailData, setDetailData] = useState<any | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 10

  const { data: sourcesData } = useSources()
  const sources = sourcesData?.sources || []

  const { data, isLoading } = useExtractedData({
    category: categoryFilter,
    source: sourceFilter,
    sort: sortOrder,
    page,
    limit: pageSize,
  })

  const results = data?.data || []
  const total = data?.total || 0
  const totalPages = data?.totalPages || 1

  const categories = [...new Set(results.map((d) => d.category).filter(Boolean))]

  const getChunk = (item: any): PopulatedChunk | null => {
    if (item.chunkId && typeof item.chunkId === "object" && "_id" in item.chunkId) {
      return item.chunkId as PopulatedChunk
    }
    return null
  }

  const filtered = search
    ? results.filter((d) => {
        const q = search.toLowerCase()
        return (
          (d.cropName || "").toLowerCase().includes(q) ||
          (d.scientificName || "").toLowerCase().includes(q)
        )
      })
    : results

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Extracted Data</h1>

      <div className="flex flex-wrap gap-4">
        <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          placeholder="Search crop name..."
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
                <TableHead>Crop</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-20">Chunk #</TableHead>
                <TableHead className="w-28">Validated</TableHead>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-16">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No extracted data found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => {
                  const chunk = getChunk(item)
                  return (
                    <TableRow key={item._id}>
                      <TableCell className="font-medium">
                        {item.cropName || <span className="text-amber-600">[No crop name]</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.category}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate text-sm">
                        {chunk?.source || "Unknown"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {chunk ? `#${chunk.chunkIndex}` : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.validatedAt ? "default" : "outline"}>
                          {item.validatedAt ? "Yes" : "No"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {item.validatedAt ? new Date(item.validatedAt).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => setDetailData(item)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {total} record{total !== 1 ? "s" : ""}
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

      {detailData && (
        <Dialog open={!!detailData} onOpenChange={(open) => !open && setDetailData(null)}>
          <DialogContent className="max-w-3xl flex flex-col max-h-[80vh]">
            <DialogHeader className="shrink-0 overflow-hidden">
              <DialogTitle className="flex items-center gap-2 overflow-hidden">
                <span className="overflow-hidden text-ellipsis whitespace-nowrap pr-6">
                  {detailData.cropName || "[No crop name]"}
                </span>
                <Badge variant="secondary" className="shrink-0">{detailData.category}</Badge>
                {detailData.validatedAt && <Badge className="shrink-0">Validated</Badge>}
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="extracted">
              <TabsList className="shrink-0">
                <TabsTrigger value="extracted">Extracted Data</TabsTrigger>
                <TabsTrigger value="chunk">Chunk Info</TabsTrigger>
              </TabsList>

              <TabsContent value="extracted" className="mt-3">
                <div className="max-h-[55vh] overflow-y-auto overflow-x-hidden rounded border bg-muted p-3 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding">
                  <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                    {JSON.stringify(detailData, null, 2)}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="chunk" className="mt-3">
                {(() => {
                  const chunk = getChunk(detailData)
                  if (!chunk) {
                    return (
                      <div className="py-8 text-center text-muted-foreground">
                        No chunk data available
                      </div>
                    )
                  }
                  return (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Source: </span>
                          <span className="font-medium break-words">{chunk.source}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Chunk Index: </span>
                          <span className="font-medium">#{chunk.chunkIndex}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Chunk ID: </span>
                          <span className="font-mono text-xs break-all">{chunk._id}</span>
                        </div>
                      </div>
                      <div className="max-h-[45vh] overflow-y-auto overflow-x-hidden rounded border bg-muted p-3 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding">
                        <pre className="text-xs font-mono whitespace-pre-wrap break-words">
                          {JSON.stringify(chunk, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )
                })()}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
