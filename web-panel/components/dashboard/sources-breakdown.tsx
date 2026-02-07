"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface SourcesBreakdownProps {
  sources: { source: string; total: number; processed: number }[]
}

export function SourcesBreakdown({ sources }: SourcesBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sources Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sources.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No sources yet</p>
        ) : (
          sources.map((source) => {
            const percentage = source.total > 0 ? Math.round((source.processed / source.total) * 100) : 0
            return (
              <div key={source.source} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{source.source}</span>
                  <span className="text-muted-foreground">
                    {source.processed}/{source.total} ({percentage}%)
                  </span>
                </div>
                <Progress value={percentage} />
              </div>
            )
          })
        )}
      </CardContent>
    </Card>
  )
}
