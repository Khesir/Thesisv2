"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Clock,
  AlertCircle,
} from "lucide-react"

interface ProcessedChunk {
  chunkIndex: number
  status: "success" | "failed" | "processing"
  error?: string
  tokensUsed?: number
  provider?: string
  requestId?: string
  details?: Record<string, unknown>
}

interface ExtractionSessionLogProps {
  chunks: ProcessedChunk[]
  isProcessing: boolean
  successCount: number
  failureCount: number
}

export function ExtractionSessionLog({
  chunks,
  isProcessing,
  successCount,
  failureCount,
}: ExtractionSessionLogProps) {
  const [expandedChunkId, setExpandedChunkId] = useState<number | null>(null)

  if (chunks.length === 0) {
    return null
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <Check className="h-4 w-4 text-green-600" />
      case "failed":
        return <X className="h-4 w-4 text-red-600" />
      case "processing":
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge variant="outline" className="bg-green-50">Success</Badge>
      case "failed":
        return <Badge variant="destructive">Failed</Badge>
      case "processing":
        return <Badge variant="secondary">Processing...</Badge>
      default:
        return null
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Extraction Session Log</CardTitle>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <span className="text-green-700 font-medium">{successCount} Success</span>
            </div>
            <div className="flex items-center gap-2">
              <X className="h-4 w-4 text-red-600" />
              <span className="text-red-700 font-medium">{failureCount} Failed</span>
            </div>
            {isProcessing && (
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600 animate-spin" />
                <span className="text-blue-700 font-medium">Processing...</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 max-h-96 overflow-y-auto">
        {chunks.map((chunk) => (
          <div
            key={chunk.chunkIndex}
            className="border rounded-lg p-3 space-y-2 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                {getStatusIcon(chunk.status)}
                <span className="font-medium">Chunk {chunk.chunkIndex}</span>
                {chunk.tokensUsed && (
                  <span className="text-xs text-muted-foreground">
                    {chunk.tokensUsed} tokens
                  </span>
                )}
                {chunk.provider && (
                  <span className="text-xs text-muted-foreground">
                    • {chunk.provider}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(chunk.status)}
                {chunk.error && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setExpandedChunkId(
                        expandedChunkId === chunk.chunkIndex ? null : chunk.chunkIndex
                      )
                    }
                    className="h-6 w-6 p-0"
                  >
                    {expandedChunkId === chunk.chunkIndex ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Expanded Error Details */}
            {expandedChunkId === chunk.chunkIndex && chunk.error && (
              <div className="mt-2 space-y-2 border-t pt-2 pl-7">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-red-700 break-words">{chunk.error}</p>
                  </div>
                </div>

                {chunk.requestId && (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 font-mono break-all">
                    Request ID: {chunk.requestId}
                  </div>
                )}

                {chunk.details && Object.keys(chunk.details).length > 0 && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                      Details
                    </summary>
                    <div className="mt-2 bg-muted/50 rounded p-2 font-mono text-xs overflow-x-auto">
                      <pre>{JSON.stringify(chunk.details, null, 2)}</pre>
                    </div>
                  </details>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-6"
                  onClick={() => {
                    const errorText = [
                      `Chunk ${chunk.chunkIndex} Error:`,
                      chunk.error,
                      chunk.requestId ? `Request ID: ${chunk.requestId}` : "",
                      chunk.details ? `\nDetails:\n${JSON.stringify(chunk.details, null, 2)}` : "",
                    ]
                      .filter(Boolean)
                      .join("\n")

                    navigator.clipboard.writeText(errorText)
                  }}
                >
                  Copy Error
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
