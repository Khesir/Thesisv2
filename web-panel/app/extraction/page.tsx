"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExtractionControls } from "@/components/extraction/extraction-controls"
import { ChunkSelector } from "@/components/extraction/chunk-selector"
import { ExtractionProgress } from "@/components/extraction/extraction-progress"
import { ExtractionResults } from "@/components/extraction/extraction-results"
import { ValidationQueue } from "@/components/extraction/validation-queue"
import { ValidationCompare } from "@/components/extraction/validation-compare"
import { ValidationActions } from "@/components/extraction/validation-actions"
import { CreateMergedDataButton } from "@/components/extraction/create-merged-data-button"
import { ExtractionSessionLog } from "@/components/extraction/extraction-session-log"
import { TokenInput, type TokenStatus } from "@/components/extraction/token-input"
import type { ProcessedChunk } from "@/components/extraction/extraction-session-log"
import { ChunkDetailDialog } from "@/components/processing/chunk-detail-dialog"

import { useChunks, useExtractedData, processChunk, confirmExtraction, mutateChunks, mutateExtracted } from "@/lib/hooks/use-api"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import type { Chunk } from "@/lib/types/chunk"

export default function ExtractionPage() {
  const [activeTab, setActiveTab] = useState("extraction")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, tokens: 0, elapsed: 0 })
  const [currentChunk, setCurrentChunk] = useState<string | null>(null)

  // Manual token state (shared across tabs)
  const [apiKey, setApiKey] = useState("")
  const [provider, setProvider] = useState("google")
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>({
    tested: false,
    valid: false,
    quotaUsed: 0,
    quotaExhausted: false,
  })
  const [isTesting, setIsTesting] = useState(false)

  // Session log state
  const [sessionLog, setSessionLog] = useState<ProcessedChunk[]>([])
  const [successCount, setSuccessCount] = useState(0)
  const [failureCount, setFailureCount] = useState(0)

  // Validation state
  const [selectedValidationId, setSelectedValidationId] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [snapshotOriginal, setSnapshotOriginal] = useState<Record<string, unknown> | null>(null)

  // View chunk dialog state
  const [viewChunk, setViewChunk] = useState<Chunk | null>(null)

  const { data: chunksData, isLoading: chunksLoading } = useChunks({ limit: 500 })
  const { data: extractedRes } = useExtractedData({ limit: 500 })

  const allChunks = chunksData?.chunks || []
  const notProcessedChunks = allChunks.filter((c) => c.status === "not-processed")
  const validationChunks = allChunks.filter((c) => c.status === "requires-validation")
  const extractedData = extractedRes?.data || []

  const hasValidToken = tokenStatus.tested && tokenStatus.valid && !tokenStatus.quotaExhausted

  // Detect 429 / quota / rate-limit errors from the Python adapter error strings
  function isQuotaError(errorMsg: string): boolean {
    const lower = errorMsg.toLowerCase()
    return lower.includes("429") ||
      lower.includes("quota") ||
      lower.includes("rate limit") ||
      lower.includes("rate_limit") ||
      lower.includes("resource_exhausted") ||
      lower.includes("too many requests")
  }

  function markQuotaExhausted() {
    setTokenStatus((prev) => ({ ...prev, quotaExhausted: true }))
    toast.warning("Quota exhausted (429). Swap to a different key or wait, then re-test.")
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

  const handleTestToken = async () => {
    if (!apiKey.trim()) return
    setIsTesting(true)

    try {
      const res = await fetch("/api/tokens/test-temp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, token: apiKey }),
      })
      const result = await res.json()

      setTokenStatus({
        tested: true,
        valid: result.valid,
        quotaUsed: 0,
        quotaExhausted: false,
        error: result.error,
      })

      if (result.valid) {
        toast.success("Token is valid and ready to use")
      } else {
        toast.error(result.error || "Token is invalid")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTokenStatus({
        tested: true,
        valid: false,
        quotaUsed: 0,
        quotaExhausted: false,
        error: msg,
      })
      toast.error(`Test failed: ${msg}`)
    } finally {
      setIsTesting(false)
    }
  }

  const handleTokenChange = (v: string) => {
    setApiKey(v)
    // Reset status when token changes
    if (tokenStatus.tested) {
      setTokenStatus({ tested: false, valid: false, quotaUsed: 0, quotaExhausted: false })
    }
  }

  const handleProviderChange = (v: string) => {
    setProvider(v)
    // Reset status when provider changes
    if (tokenStatus.tested) {
      setTokenStatus({ tested: false, valid: false, quotaUsed: 0, quotaExhausted: false })
    }
  }

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

          // Auto-detect 429 / quota errors and stop the loop
          if (isQuotaError(errMsg)) {
            markQuotaExhausted()
            break
          }
        } else {
          localSuccessCount++
          setTokenStatus((prev) => ({
            ...prev,
            quotaUsed: prev.quotaUsed + 1,
          }))

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
      const result = await confirmExtraction({
        chunkId,
        action: "reject-permanent",
      })
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

  const handleViewChunk = (chunkId: string) => {
    const chunk = allChunks.find((c) => c._id === chunkId)
    if (chunk) {
      setViewChunk(chunk)
    }
  }

  const selectedChunkExtractions = selectedValidationId
    ? extractedData
        .filter((d) => {
          const chunkId = typeof d.chunkId === "string" ? d.chunkId : d.chunkId?._id
          return chunkId === selectedValidationId
        })
        .sort((a, b) => {
          const aTime = new Date(a.createdAt || 0).getTime()
          const bTime = new Date(b.createdAt || 0).getTime()
          return aTime - bTime
        })
    : []

  const selectedOriginal = selectedChunkExtractions[0] || null
  const selectedNewExtraction = selectedChunkExtractions.length > 1 ? selectedChunkExtractions[selectedChunkExtractions.length - 1] : null

  const handleRunValidation = async () => {
    if (!selectedValidationId) return

    if (!hasValidToken) {
      toast.error("Please test and validate your API token first.")
      return
    }

    setIsValidating(true)

    const chunk = allChunks.find((c) => c._id === selectedValidationId)
    if (!chunk) {
      setIsValidating(false)
      return
    }

    if (selectedOriginal) {
      setSnapshotOriginal(JSON.parse(JSON.stringify(selectedOriginal)))
    }

    const isFirstValidation = selectedChunkExtractions.length === 1

    toast.info(
      isFirstValidation
        ? `Validating chunk #${chunk.chunkIndex} with initial extraction...`
        : `Re-validating chunk #${chunk.chunkIndex}...`
    )

    try {
      const result = await processChunk({
        chunkId: chunk._id,
        content: chunk.content,
        provider,
        apiKey,
        strategy: "failover",
      })
      if (result.success) {
        setTokenStatus((prev) => ({
          ...prev,
          quotaUsed: prev.quotaUsed + 1,
        }))
        toast.success("Validation extraction complete - review both versions")
        await mutateExtracted()
      } else {
        const errMsg = result.error || "Validation failed"
        if (isQuotaError(errMsg)) {
          markQuotaExhausted()
        } else {
          toast.error(errMsg)
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (isQuotaError(msg)) {
        markQuotaExhausted()
      } else {
        toast.error(`Validation failed: ${msg}`)
      }
    } finally {
      setIsValidating(false)
    }
  }

  const handleValidationDecisionOriginal = async () => {
    if (!selectedValidationId || !selectedOriginal) return
    const dataToSend = snapshotOriginal || (selectedOriginal as unknown as Record<string, unknown>)
    try {
      const result = await confirmExtraction({
        chunkId: selectedValidationId,
        data: dataToSend,
        action: "accept",
      })
      if (result.success) {
        toast.success("Original extraction accepted and validated")
        setSelectedValidationId(null)
        setSnapshotOriginal(null)
      } else {
        toast.error(`Failed to accept original: ${result.error || "Server returned an error"}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Failed to accept original: ${msg}`)
    }
  }

  const handleValidationDecisionNew = async () => {
    if (!selectedValidationId || !selectedNewExtraction) return
    try {
      const result = await confirmExtraction({
        chunkId: selectedValidationId,
        data: selectedNewExtraction as unknown as Record<string, unknown>,
        action: "accept",
      })
      if (result.success) {
        toast.success("New extraction accepted and validated")
        setSelectedValidationId(null)
        setSnapshotOriginal(null)
      } else {
        toast.error(`Failed to accept new extraction: ${result.error || "Server returned an error"}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Failed to accept new extraction: ${msg}`)
    }
  }

  const handleReject = async () => {
    if (!selectedValidationId) return
    try {
      const result = await confirmExtraction({
        chunkId: selectedValidationId,
        action: "reject",
      })
      if (result.success) {
        toast.info("Chunk rejected, moved back to not-processed")
        setSelectedValidationId(null)
        setSnapshotOriginal(null)
      } else {
        toast.error(`Failed to reject: ${result.error || "Server returned an error"}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Failed to reject chunk: ${msg}`)
    }
  }

  if (chunksLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">EBR Filter</h1>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">EBR Filter</h1>

      <TokenInput
        token={apiKey}
        onTokenChange={handleTokenChange}
        provider={provider}
        onProviderChange={handleProviderChange}
        tokenStatus={tokenStatus}
        onTest={handleTestToken}
        isTesting={isTesting}
        disabled={isProcessing || isValidating}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="extraction">Extraction</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
        </TabsList>

        <TabsContent value="extraction" className="space-y-6 mt-4">
          <ExtractionControls
            selectedCount={selectedIds.length}
            onStartExtraction={handleStartExtraction}
            isProcessing={isProcessing}
            isDisabled={!hasValidToken}
          />

          <ChunkSelector
            chunks={notProcessedChunks}
            allChunks={allChunks}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
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
        </TabsContent>

        <TabsContent value="validation" className="space-y-6 mt-4">
          <ValidationQueue
            chunks={validationChunks}
            allChunks={allChunks}
            selectedId={selectedValidationId}
            onSelect={(id) => {
              setSelectedValidationId(id)
              setSnapshotOriginal(null)
            }}
          />

          <ValidationActions
            hasSelection={!!selectedValidationId}
            hasNewExtraction={!!selectedNewExtraction}
            isValidating={isValidating}
            hasValidToken={hasValidToken}
            onRunValidation={handleRunValidation}
            onAcceptOriginal={handleValidationDecisionOriginal}
            onAcceptNew={handleValidationDecisionNew}
            onReject={handleReject}
            onSkip={() => {
              const idx = validationChunks.findIndex((c) => c._id === selectedValidationId)
              const next = validationChunks[idx + 1]
              setSelectedValidationId(next?._id || null)
              setSnapshotOriginal(null)
            }}
          />

          <CreateMergedDataButton
            extractedData={extractedData}
            onSuccess={() => {
              mutateExtracted()
              toast.success("Merged data created successfully!")
            }}
          />

          <ValidationCompare
            original={(snapshotOriginal || selectedOriginal) as any}
            newExtraction={selectedNewExtraction as any}
          />
        </TabsContent>
      </Tabs>

      <ChunkDetailDialog
        chunk={viewChunk}
        open={!!viewChunk}
        onOpenChange={(open) => !open && setViewChunk(null)}
      />
    </div>
  )
}
