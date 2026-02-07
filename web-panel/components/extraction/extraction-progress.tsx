"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { X, Loader2 } from "lucide-react"

interface ExtractionProgressProps {
  current: number
  total: number
  tokensUsed: number
  elapsedSeconds: number
  currentChunk?: string | null
  onCancel: () => void
}

export function ExtractionProgress({
  current,
  total,
  tokensUsed,
  elapsedSeconds,
  currentChunk,
  onCancel,
}: ExtractionProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0
  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            Processing {current}/{total} chunks
          </span>
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="mr-1 h-3 w-3" />
            Cancel
          </Button>
        </div>

        <Progress value={percentage} />

        {/* Current Chunk Indicator */}
        {currentChunk && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Currently processing: Chunk {currentChunk}</span>
          </div>
        )}

        <div className="flex gap-6 text-sm text-muted-foreground">
          <span>Tokens: {tokensUsed.toLocaleString()}</span>
          <span>
            Elapsed: {minutes}m {seconds}s
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

