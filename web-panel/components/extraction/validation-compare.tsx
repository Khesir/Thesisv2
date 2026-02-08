"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { type ExtractedDataResponse } from "@/lib/entities/extracted-data"

interface ValidationCompareProps {
  original: ExtractedDataResponse | null
  newExtraction: ExtractedDataResponse | null
}

export function ValidationCompare({
  original,
  newExtraction,
}: ValidationCompareProps) {
  if (!original) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Select a chunk from the queue and run validation to compare results
        </CardContent>
      </Card>
    )
  }

  // Calculate consistency if both exist
  const consistency = newExtraction
    ? calculateConsistency(original, newExtraction)
    : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">JSON Comparison</CardTitle>
          {consistency !== null && (
            <Badge
              variant={consistency >= 80 ? "default" : "secondary"}
              className={consistency >= 80 ? "bg-green-600" : "bg-yellow-600"}
            >
              {consistency}% Match
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 h-96">
          {/* Original */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-muted-foreground border-b pb-2">
              Original Extraction
            </div>
            <ScrollArea className="h-80 rounded border bg-muted p-3">
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {JSON.stringify(original, null, 2)}
              </pre>
            </ScrollArea>
          </div>

          {/* New Extraction */}
          <div className="space-y-2">
            <div className="text-sm font-semibold text-muted-foreground border-b pb-2">
              {newExtraction ? "New Extraction" : "No new extraction yet"}
            </div>
            {newExtraction ? (
              <ScrollArea className="h-80 rounded border bg-muted p-3">
                <pre className="text-xs font-mono whitespace-pre-wrap">
                  {JSON.stringify(newExtraction, null, 2)}
                </pre>
              </ScrollArea>
            ) : (
              <div className="h-80 rounded border bg-muted p-3 flex items-center justify-center text-muted-foreground">
                Run validation to see new extraction
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function calculateConsistency(
  original: ExtractedDataResponse,
  newExtraction: ExtractedDataResponse
): number {
  const originalJson = JSON.stringify(original)
  const newJson = JSON.stringify(newExtraction)
  
  // Simple comparison: calculate how many fields match
  const originalStr = JSON.stringify(original, Object.keys(original).sort())
  const newStr = JSON.stringify(newExtraction, Object.keys(newExtraction).sort())
  
  if (originalStr === newStr) return 100
  
  // Count matching keys/values
  const origKeys = new Set(Object.keys(original))
  const newKeys = new Set(Object.keys(newExtraction))
  const commonKeys = [...origKeys].filter(k => newKeys.has(k))
  const matchingFields = commonKeys.filter(
    k => JSON.stringify((original as any)[k]) === JSON.stringify((newExtraction as any)[k])
  )
  
  return Math.round((matchingFields.length / commonKeys.length) * 100)
}
