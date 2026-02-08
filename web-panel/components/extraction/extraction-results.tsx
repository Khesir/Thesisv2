"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowRight, ChevronDown, ChevronRight } from "lucide-react"
import { type ExtractedDataResponse } from "@/lib/entities/extracted-data"

interface ExtractionResultsProps {
  results: ExtractedDataResponse[]
}

export function ExtractionResults({ results }: ExtractionResultsProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (results.length === 0) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Recent Results</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/extracted" className="gap-1">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {results.map((result) => (
            <div key={result._id} className="rounded-lg border">
              <button
                className="flex w-full items-center justify-between p-3 text-left hover:bg-muted/50"
                onClick={() => setExpandedId(expandedId === result._id ? null : result._id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {expandedId === result._id ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                  <span className="font-medium truncate">
                    {result.cropName || <span className="text-amber-600">[No crop name]</span>}
                  </span>
                  <Badge variant="secondary" className="shrink-0">{result.category}</Badge>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {new Date(result.createdAt).toLocaleDateString()}
                </span>
              </button>

              {expandedId === result._id && (
                <div className="border-t p-3">
                  <ScrollArea className="h-[250px] rounded border bg-muted p-3">
                    <pre className="text-xs font-mono whitespace-pre-wrap">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
