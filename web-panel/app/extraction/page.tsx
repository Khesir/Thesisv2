"use client"

import { useState, useEffect } from "react"
import { ExtractionControls } from "@/components/extraction/extraction-controls"
import { ChunkSelector } from "@/components/extraction/chunk-selector"
import { ExtractionProgress } from "@/components/extraction/extraction-progress"
import { ExtractionResults } from "@/components/extraction/extraction-results"
import { ExtractionSessionLog } from "@/components/extraction/extraction-session-log"
import { TokenInput } from "@/components/extraction/token-input"
import type { ProcessedChunk } from "@/components/extraction/extraction-session-log"
import { ChunkDetailDialog } from "@/components/processing/chunk-detail-dialog"
import { useToken } from "@/lib/context/token-context"

import { useChunks, useExtractedData, processChunk, confirmExtraction, mutateChunks, mutateExtracted } from "@/lib/hooks/use-api"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import type { Chunk } from "@/lib/types/chunk"

export default function ExtractionPage() {
  const { apiKey, provider, tokenStatus, isTesting, handleTokenChange, handleProviderChange, handleTestToken, markQuotaExhausted, incrementQuotaUsed } = useToken()

  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, tokens: 0, elapsed: 0 })
  const [currentChunk, setCurrentChunk] = useState<string | null>(null)

  // Session log state
  const [sessionLog, setSessionLog] = useState<ProcessedChunk[]>([])
  const [successCount, setSuccessCount] = useState(0)
  const [failureCount, setFailureCount] = useState(0)

  // View chunk dialog state
  const [viewChunk, setViewChunk] = useState<Chunk | null>(null)

  const { data: chunksData, isLoading: chunksLoading } = useChunks({ limit: 500 })
  const { data: extractedRes } = useExtractedData({ limit: 500 })

  const allChunks = chunksData?.chunks || []
  const notProcessedChunks = allChunks.filter((c) => c.status === "not-processed")
  const extractedData = extractedRes?.data || []

  const hasValidToken = tokenStatus.tested && tokenStatus.valid && !tokenStatus.quotaExhausted

  function isQuotaError(errorMsg: string): boolean {
    const lower = errorMsg.toLowerCase()
    return lower.includes("429") ||
      lower.includes("quota") ||
      lower.includes("rate limit") ||
      lower.includes("rate_limit") ||
      lower.includes("resource_exhausted") ||
      lower.includes("too many requests")
  }

  // Real-time elapsed timer
  useEffect(() => {
    if (!isProcessing) return

    const timer = setInterval(() => {
      setProgress((p) => ({
        ...p,
        elapsed: p.elapsed + 1,
      }))
    }, 1000)

    return () => clearInterval(timer)
  }, [isProcessing])

  const addToSessionLog = (chunk: ProcessedChunk) => {
    setSessionLog((prev) => [...prev, chunk])
    if (chunk.status === "success") {
      setSuccessCount((c) => c + 1)
    } else if (chunk.status === "failed") {
      setFailureCount((c) => c + 1)
    }
  }

  const handleStartExtraction = async () => {
    if (selectedIds.length === 0) {
      toast.error("Select at least one chunk")
      return
    }

    if (!hasValidToken) {
      toast.error("Please test and validate your API token first.")
      return
    }

    setIsProcessing(true)
    setProgress({ current: 0, total: selectedIds.length, tokens: 0, elapsed: 0 })
    setSessionLog([])
    setSuccessCount(0)
    setFailureCount(0)
    toast.info(`Starting extraction of ${selectedIds.length} chunks...`)

    let localSuccessCount = 0
    let localFailureCount = 0

    for (let i = 0; i < selectedIds.length; i++) {
      const chunk = allChunks.find((c) => c._id === selectedIds[i])
      if (!chunk) continue

      setCurrentChunk(`${chunk.chunkIndex + 1}/${selectedIds.length}`)

      try {
        const result = await processChunk({
          chunkId: chunk._id,
          content: chunk.content,
          provider,
          apiKey,
          strategy: "failover",
        })

        setProgress((p) => ({
          ...p,
          current: i + 1,
          tokens: p.tokens + (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
        }))

        if (!result.success) {
          localFailureCount++
          const errMsg = result.error || "Extraction failed (no error message returned)"

          addToSessionLog({
            chunkIndex: chunk.chunkIndex,
            chunkId: chunk._id,
            status: "failed",
            error: errMsg,
            traceback: result.traceback,
            tokensUsed: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
            provider: result.provider || provider,
            requestId: result.requestId,
            details: {
              chunkIndex: chunk.chunkIndex,
              provider,
              strategy: "failover",
              ...(result.errorType ? { errorType: result.errorType } : {}),
            },
          })

          if (isQuotaError(errMsg)) {
            markQuotaExhausted()
            break
          }
        } else {
          localSuccessCount++
          incrementQuotaUsed()

          addToSessionLog({
            chunkIndex: chunk.chunkIndex,
            chunkId: chunk._id,
            status: "success",
            tokensUsed: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
            provider: result.provider,
            tokenAlias: result.tokenAlias,
          })
        }
      } catch (error) {
        localFailureCount++
        const errorMsg = error instanceof Error ? error.message : String(error)
        addToSessionLog({
          chunkIndex: chunk.chunkIndex,
          chunkId: chunk._id,
          status: "failed",
          error: errorMsg || "Network or connection error",
          details: {
            chunkIndex: chunk.chunkIndex,
            errorType: error instanceof Error ? error.constructor.name : typeof error,
            provider,
            strategy: "failover",
          },
        })

        if (isQuotaError(errorMsg)) {
          markQuotaExhausted()
          break
        }
      }
    }

    setIsProcessing(false)
    setCurrentChunk(null)
    setSelectedIds([])
    mutateChunks()
    mutateExtracted()

    if (localFailureCount === 0 && localSuccessCount > 0) {
      toast.success(`All ${localSuccessCount} chunks extracted successfully!`)
    } else if (localSuccessCount === 0) {
      toast.error(`All ${localFailureCount} chunks failed`)
    } else {
      toast.info(`${localSuccessCount} succeeded, ${localFailureCount} failed`)
    }
  }

  const handleRejectChunk = async (chunkId: string) => {
    try {
      const result = await confirmExtraction({ chunkId, action: "reject-permanent" })
      if (result.success) {
        toast.info("Chunk rejected permanently")
        mutateChunks()
      } else {
        toast.error(`Failed to reject: ${result.error || "Server returned an error"}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Failed to reject chunk: ${msg}`)
    }
  }

  const handleMassReject = async () => {
    const ids = [...selectedIds]
    setSelectedIds([])
    let failed = 0
    await Promise.all(
      ids.map(async (chunkId) => {
        try {
          const result = await confirmExtraction({ chunkId, action: "reject-permanent" })
          if (!result.success) failed++
        } catch {
          failed++
        }
      })
    )
    mutateChunks()
    if (failed === 0) {
      toast.info(`${ids.length} chunk${ids.length !== 1 ? "s" : ""} rejected permanently`)
    } else {
      toast.warning(`${ids.length - failed} rejected, ${failed} failed`)
    }
  }

  const handleViewChunk = (chunkId: string) => {
    const chunk = allChunks.find((c) => c._id === chunkId)
    if (chunk) {
      setViewChunk(chunk)
    }
  }

  if (chunksLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Extraction</h1>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Extraction</h1>

      <TokenInput
        token={apiKey}
        onTokenChange={handleTokenChange}
        provider={provider}
        onProviderChange={handleProviderChange}
        tokenStatus={tokenStatus}
        onTest={handleTestToken}
        isTesting={isTesting}
        disabled={isProcessing}
      />

      <ExtractionControls
        selectedCount={selectedIds.length}
        onStartExtraction={handleStartExtraction}
        onMassReject={handleMassReject}
        isProcessing={isProcessing}
        isDisabled={!hasValidToken}
      />

      <ChunkSelector
        chunks={notProcessedChunks}
        allChunks={allChunks}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRejectChunk={handleRejectChunk}
      />

      {isProcessing && (
        <ExtractionProgress
          current={progress.current}
          total={progress.total}
          tokensUsed={progress.tokens}
          elapsedSeconds={progress.elapsed}
          currentChunk={currentChunk}
          onCancel={() => {
            setIsProcessing(false)
            toast.info("Extraction cancelled")
          }}
        />
      )}

      {sessionLog.length > 0 && (
        <ExtractionSessionLog
          chunks={sessionLog}
          isProcessing={isProcessing}
          successCount={successCount}
          failureCount={failureCount}
          onRejectChunk={handleRejectChunk}
          onViewChunk={handleViewChunk}
        />
      )}

      <ExtractionResults results={extractedData.slice(0, 10) as any} />

      <ChunkDetailDialog
        chunk={viewChunk}
        open={!!viewChunk}
        onOpenChange={(open) => !open && setViewChunk(null)}
      />
    </div>
  )
}
