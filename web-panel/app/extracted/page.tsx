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
import { Eye, ArrowUpDown, Code } from "lucide-react"
import { useExtractedData, useSources } from "@/lib/hooks/use-api"
import { Skeleton } from "@/components/ui/skeleton"

export default function ExtractedDataPage() {
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null)
  const [showJson, setShowJson] = useState(false)
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

  // Extract unique categories from results
  const categories = [...new Set(results.map((d) => d.category).filter(Boolean))]

  const getSource = (item: Record<string, unknown>) => {
    const chunkId = item.chunkId as { source?: string } | string | null
    if (chunkId && typeof chunkId === "object" && "source" in chunkId) {
      return chunkId.source || "Unknown"
    }
    return "Unknown"
  }

  // Client-side search filter
  const filtered = search
    ? results.filter((d) => {
        const q = search.toLowerCase()
        return (
          d.cropName.toLowerCase().includes(q) ||
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
                <TableHead>Scientific Name</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="w-28">Soil pH</TableHead>
                <TableHead className="w-28">Temp</TableHead>
                <TableHead className="w-28">Yield</TableHead>
                <TableHead className="w-28">Validated</TableHead>
                <TableHead className="w-16">View</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No extracted data found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-medium">{item.cropName}</TableCell>
                    <TableCell className="text-muted-foreground italic">
                      {item.scientificName || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-sm">
                      {getSource(item as unknown as Record<string, unknown>)}
                    </TableCell>
                    <TableCell className="text-sm">{item.soilRequirements?.ph_range}</TableCell>
                    <TableCell className="text-sm">{item.climateRequirements?.temperature}</TableCell>
                    <TableCell className="text-sm">
                      {item.yieldInfo?.average} {item.yieldInfo?.unit}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.validatedAt ? "default" : "outline"}>
                        {item.validatedAt ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => { setDetailData(item as unknown as Record<string, unknown>); setShowJson(false) }}>
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {(detailData as { cropName?: string }).cropName} ({(detailData as { scientificName?: string }).scientificName || (detailData as { category?: string }).category})
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="max-h-[500px]">
              <div className="space-y-4 pr-4">
                <div className="text-sm">
                  <span className="text-muted-foreground">Source: </span>
                  <span>{getSource(detailData)}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-1">Soil Requirements</h4>
                    <p>Types: {((detailData as { soilRequirements?: { types?: string[] } }).soilRequirements?.types || []).join(", ")}</p>
                    <p>pH: {(detailData as { soilRequirements?: { ph_range?: string } }).soilRequirements?.ph_range}</p>
                    <p>Drainage: {(detailData as { soilRequirements?: { drainage?: string } }).soilRequirements?.drainage}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Climate Requirements</h4>
                    <p>Temp: {(detailData as { climateRequirements?: { temperature?: string } }).climateRequirements?.temperature}</p>
                    <p>Rainfall: {(detailData as { climateRequirements?: { rainfall?: string } }).climateRequirements?.rainfall}</p>
                    <p>Humidity: {(detailData as { climateRequirements?: { humidity?: string } }).climateRequirements?.humidity}</p>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowJson(!showJson)}
                  >
                    <Code className="mr-1 h-3 w-3" />
                    {showJson ? "Hide" : "View"} JSON
                  </Button>
                </div>

                {showJson && (
                  <ScrollArea className="h-[200px] rounded border bg-muted p-2">
                    <pre className="text-xs">{JSON.stringify(detailData, null, 2)}</pre>
                  </ScrollArea>
                )}
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
