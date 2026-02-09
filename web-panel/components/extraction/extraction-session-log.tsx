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
  Eye,
  Ban,
} from "lucide-react"

export interface ProcessedChunk {
  chunkIndex: number
  chunkId?: string
  status: "success" | "failed" | "processing"
  error?: string
  traceback?: string
  tokensUsed?: number
  provider?: string
  tokenAlias?: string
  requestId?: string
  details?: Record<string, unknown>
}

interface ExtractionSessionLogProps {
  chunks: ProcessedChunk[]
  isProcessing: boolean
  successCount: number
  failureCount: number
  onRejectChunk?: (chunkId: string) => void
  onViewChunk?: (chunkId: string) => void
}

export function ExtractionSessionLog({
  chunks,
  isProcessing,
  successCount,
  failureCount,
  onRejectChunk,
  onViewChunk,
}: ExtractionSessionLogProps) {
  const [expandedChunkId, setExpandedChunkId] = useState<number | null>(null)
  const [minimized, setMinimized] = useState(false)

  if (chunks.length === 0) {
    return null
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <Check className="h-4 w-4 text-green-700 font-bold" />
      case "failed":
        return <X className="h-4 w-4 text-red-700 font-bold" />
      case "processing":
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />
      default:
        return null
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-600 text-white hover:bg-green-700">Success</Badge>
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
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => setMinimized(!minimized)}
            >
              {minimized ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </Button>
            <CardTitle className="text-base">Session Log</CardTitle>
          </div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Check className="h-3.5 w-3.5 text-green-600" />
              <span className="text-green-700 font-medium">{successCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <X className="h-3.5 w-3.5 text-red-600" />
              <span className="text-red-700 font-medium">{failureCount}</span>
            </div>
            {isProcessing && (
              <Clock className="h-3.5 w-3.5 text-blue-600 animate-spin" />
            )}
          </div>
        </div>
      </CardHeader>

      {!minimized && <CardContent className="space-y-2 max-h-96 overflow-y-auto">
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
                {(chunk.provider || chunk.tokenAlias) && (
                  <span className="text-xs text-muted-foreground">
                    • {chunk.provider}{chunk.tokenAlias ? ` (${chunk.tokenAlias})` : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(chunk.status)}
                {(chunk.error || chunk.traceback || chunk.tokensUsed || chunk.details) && (
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

            {/* Expanded Details (Success/Error) */}
            {expandedChunkId === chunk.chunkIndex && (chunk.error || chunk.traceback || chunk.tokensUsed || chunk.details) && (
              <div className="mt-2 space-y-2 border-t pt-2 pl-7">
                {/* Error Section */}
                {chunk.error && (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-red-700 break-words">{chunk.error}</p>
                    </div>
                  </div>
                )}

                {chunk.traceback && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-red-600 hover:text-red-800 font-medium">
                      Python Traceback
                    </summary>
                    <pre className="mt-2 bg-red-50 text-red-800 rounded p-2 font-mono text-xs whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                      {chunk.traceback}
                    </pre>
                  </details>
                )}

                {/* Success Details */}
                {chunk.status === "success" && chunk.tokensUsed && (
                  <div className="space-y-1 text-xs">
                    <p className="text-green-700 font-medium">✓ Extraction Success</p>
                    <p className="text-muted-foreground">Tokens used: <span className="font-mono">{chunk.tokensUsed}</span></p>
                    {chunk.provider && (
                      <p className="text-muted-foreground">Provider: <span className="font-mono">{chunk.provider}</span></p>
                    )}
                    {chunk.tokenAlias && (
                      <p className="text-muted-foreground">Token: <span className="font-mono">{chunk.tokenAlias}</span></p>
                    )}
                  </div>
                )}

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

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  {chunk.chunkId && onViewChunk && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => onViewChunk(chunk.chunkId!)}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      View
                    </Button>
                  )}

                  {chunk.status === "failed" && chunk.chunkId && onRejectChunk && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      onClick={() => onRejectChunk(chunk.chunkId!)}
                    >
                      <Ban className="h-3.5 w-3.5 mr-1" />
                      Reject
                    </Button>
                  )}

                  {chunk.error && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => {
                        const errorText = [
                          `Chunk ${chunk.chunkIndex} Error:`,
                          chunk.error,
                          chunk.requestId ? `Request ID: ${chunk.requestId}` : "",
                          chunk.traceback ? `\nPython Traceback:\n${chunk.traceback}` : "",
                          chunk.details ? `\nDetails:\n${JSON.stringify(chunk.details, null, 2)}` : "",
                        ]
                          .filter(Boolean)
                          .join("\n")

                        navigator.clipboard.writeText(errorText)
                      }}
                    >
                      Copy Error
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </CardContent>}
    </Card>
  )
}
