"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronDown, ChevronRight, CheckCircle, Code } from "lucide-react"
import { type ExtractedDataResponse } from "@/lib/entities/extracted-data"
import { type ChunkResponse } from "@/lib/entities/chunk"

interface ExtractionResultsProps {
  results: ExtractedDataResponse[]
  chunks: ChunkResponse[]
}

export function ExtractionResults({ results, chunks }: ExtractionResultsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showJson, setShowJson] = useState<string | null>(null)

  if (results.length === 0) return null

  const getSource = (chunkId: string) => {
    const chunk = chunks.find((c) => c._id === chunkId)
    return chunk?.source || "Unknown"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {results.map((result) => (
          <div key={result._id} className="rounded-lg border">
            <button
              className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50"
              onClick={() =>
                setExpandedId(expandedId === result._id ? null : result._id)
              }
            >
              <div className="flex items-center gap-2">
                {expandedId === result._id ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span className="font-medium">{result.cropName}</span>
                <Badge variant="secondary">{result.category}</Badge>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {getSource(result.chunkId)}
                </span>
              </div>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </button>

            {expandedId === result._id && (
              <div className="border-t p-3 space-y-2 text-sm">
                <div>
                  <strong>Source:</strong> {getSource(result.chunkId)}
                </div>
                <div>
                  <strong>Soil:</strong>{" "}
                  {result.soilRequirements.types.join(", ")}, pH{" "}
                  {result.soilRequirements.ph_range}
                </div>
                <div>
                  <strong>Climate:</strong>{" "}
                  {result.climateRequirements.temperature},{" "}
                  {result.climateRequirements.rainfall}
                </div>
                <div>
                  <strong>Planting:</strong> {result.plantingInfo.season},{" "}
                  {result.plantingInfo.duration}
                </div>
                <div>
                  <strong>Yield:</strong> {result.yieldInfo.average}{" "}
                  {result.yieldInfo.unit} (range: {result.yieldInfo.range})
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setShowJson(showJson === result._id ? null : result._id)
                    }
                  >
                    <Code className="mr-1 h-3 w-3" />
                    {showJson === result._id ? "Hide" : "View"} JSON
                  </Button>
                </div>

                {showJson === result._id && (
                  <ScrollArea className="h-[200px] rounded border bg-muted p-2">
                    <pre className="text-xs">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
