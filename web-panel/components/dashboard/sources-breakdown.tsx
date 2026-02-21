"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface SourcesBreakdownProps {
  sources: { source: string; total: number; processed: number }[]
}

export function SourcesBreakdown({ sources }: SourcesBreakdownProps) {
  return (
    <Card className="flex flex-col h-105">
      <CardHeader>
        <CardTitle>Sources Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        {sources.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No sources yet</p>
        ) : (
          <div className="flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding">
            <div className="space-y-4 pr-3">
              {sources.map((source) => {
                const percentage = source.total > 0 ? Math.round((source.processed / source.total) * 100) : 0
                return (
                  <div key={source.source} className="space-y-2">
                    <div className="flex items-start justify-between gap-2 text-sm">
                      <span className="font-medium break-words min-w-0">{source.source}</span>
                      <span className="text-muted-foreground shrink-0 whitespace-nowrap">
                        {source.processed}/{source.total} ({percentage}%)
                      </span>
                    </div>
                    <Progress value={percentage} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
