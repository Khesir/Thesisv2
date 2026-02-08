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
import { ExtractionSessionLog } from "@/components/extraction/extraction-session-log"

import { useChunks, useExtractedData, processChunk, confirmExtraction, mutateChunks, mutateExtracted, useTokens, mutateTokens } from "@/lib/hooks/use-api"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Clock } from "lucide-react"
import { toast } from "sonner"

interface ProcessedChunk {
  chunkIndex: number
  status: "success" | "failed" | "processing"
  error?: string
  tokensUsed?: number
  provider?: string
  requestId?: string
  details?: Record<string, unknown>
}

export default function ExtractionPage() {
  const [activeTab, setActiveTab] = useState("extraction")
  const [provider, setProvider] = useState("auto")
  const [strategy, setStrategy] = useState("failover")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, tokens: 0, elapsed: 0 })
  const [currentChunk, setCurrentChunk] = useState<string | null>(null)

  // Session log state
  const [sessionLog, setSessionLog] = useState<ProcessedChunk[]>([])
  const [successCount, setSuccessCount] = useState(0)
  const [failureCount, setFailureCount] = useState(0)

  // Validation state
  const [selectedValidationId, setSelectedValidationId] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  // Snapshot of original extraction so it doesn't change on SWR refetch
  const [snapshotOriginal, setSnapshotOriginal] = useState<Record<string, unknown> | null>(null)

  const { data: chunksData, isLoading: chunksLoading } = useChunks({ limit: 500 })
  const { data: extractedRes } = useExtractedData({ limit: 500 })
  const { data: tokensData } = useTokens({ refreshInterval: 15000 })

  const allChunks = chunksData?.chunks || []
  const notProcessedChunks = allChunks.filter((c) => c.status === "not-processed")
  const validationChunks = allChunks.filter((c) => c.status === "requires-validation")
  const extractedData = extractedRes?.data || []

  // Calculate available tokens (accounting for rate limits and quota)
  const allTokens = tokensData?.tokens || []
  const availableTokens = allTokens.filter((t) =>
    t.isActive &&
    !t.rateLimited &&
    (t.usageLimit === null || t.usageCount < t.usageLimit) &&
    (t.quotaLimit === null || t.quotaUsed < t.quotaLimit)
  )
  const rateLimitedTokens = allTokens.filter((t) => t.isActive && t.rateLimited)
  const hasAvailableTokens = availableTokens.length > 0

  // Find the minimum cooldown remaining for "next available" message
  const minCooldownRemaining = rateLimitedTokens.length > 0
    ? Math.min(...rateLimitedTokens.map((t) => t.cooldownRemaining))
    : 0

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

    if (!hasAvailableTokens) {
      toast.error("No available tokens. Please add or activate tokens in Settings.")
      return
    }

    setIsProcessing(true)
    setProgress({ current: 0, total: selectedIds.length, tokens: 0, elapsed: 0 })
    setSessionLog([])
    setSuccessCount(0)
    setFailureCount(0)
    toast.info(`Starting extraction of ${selectedIds.length} chunks...`)

    for (let i = 0; i < selectedIds.length; i++) {
      const chunk = allChunks.find((c) => c._id === selectedIds[i])
      if (!chunk) continue

      // Update current chunk being processed
      setCurrentChunk(`${chunk.chunkIndex + 1}/${selectedIds.length}`)

      try {
        const result = await processChunk({
          chunkId: chunk._id,
          content: chunk.content,
          provider: provider === "auto" ? undefined : provider,
          strategy,
        })

        setProgress((p) => ({
          ...p,
          current: i + 1,
          tokens: p.tokens + (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
        }))

        if (!result.success) {
          addToSessionLog({
            chunkIndex: chunk.chunkIndex,
            status: "failed",
            error: result.error || "Extraction failed",
            tokensUsed: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
            provider: (result as any).provider || provider,
            requestId: (result as any).requestId,
            details: {
              chunkIndex: chunk.chunkIndex,
              provider: provider === "auto" ? "auto" : provider,
              strategy,
            },
          })
        } else {
          addToSessionLog({
            chunkIndex: chunk.chunkIndex,
            status: "success",
            tokensUsed: (result.usage?.input_tokens || 0) + (result.usage?.output_tokens || 0),
            provider: result.provider,
          })
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error"
        addToSessionLog({
          chunkIndex: chunk.chunkIndex,
          status: "failed",
          error: errorMsg,
          details: {
            chunkIndex: chunk.chunkIndex,
            error: "Failed to process chunk",
          },
        })
      }
    }

    setIsProcessing(false)
    setCurrentChunk(null)
    setSelectedIds([])
    mutateChunks()
    mutateExtracted()
    mutateTokens()

    if (failureCount === 0 && successCount > 0) {
      toast.success(`All ${successCount} chunks extracted successfully!`)
    } else if (successCount === 0) {
      toast.error(`All ${failureCount} chunks failed`)
    } else {
      toast.info(`✓ ${successCount} succeeded, ✗ ${failureCount} failed`)
    }
  }

  // Get all extractions for selected chunk, sorted by creation date
  const selectedChunkExtractions = selectedValidationId
    ? extractedData
        .filter((d) => {
          const chunkId = typeof d.chunkId === "string" ? d.chunkId : d.chunkId?._id
          return chunkId === selectedValidationId
        })
        .sort((a, b) => {
          const aTime = new Date(a.createdAt || 0).getTime()
          const bTime = new Date(b.createdAt || 0).getTime()
          return aTime - bTime // ascending: oldest to newest
        })
    : []

  const selectedOriginal = selectedChunkExtractions[0] || null
  const selectedNewExtraction = selectedChunkExtractions.length > 1 ? selectedChunkExtractions[selectedChunkExtractions.length - 1] : null

  const handleRunValidation = async () => {
    if (!selectedValidationId) return
    setIsValidating(true)

    const chunk = allChunks.find((c) => c._id === selectedValidationId)
    if (!chunk) {
      setIsValidating(false)
      return
    }

    // Snapshot the original extraction before running so it won't change on refetch
    if (selectedOriginal) {
      setSnapshotOriginal(JSON.parse(JSON.stringify(selectedOriginal)))
    }

    // Check if this is first validation or re-validation
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
        provider: provider === "auto" ? undefined : provider,
        strategy,
      })
      if (result.success) {
        toast.success("Validation extraction complete - review both versions")
        // Refresh extracted data to get the new extraction
        await mutateExtracted()
      } else {
        toast.error(result.error || "Validation failed")
      }
    } catch {
      toast.error("Validation failed")
    } finally {
      setIsValidating(false)
    }
  }

  const handleValidationDecisionOriginal = async () => {
    if (!selectedValidationId || !selectedOriginal) return
    const dataToSend = snapshotOriginal || (selectedOriginal as unknown as Record<string, unknown>)
    const result = await confirmExtraction({
      chunkId: selectedValidationId,
      data: dataToSend,
      action: "accept",
    })
    if (result.success) {
      toast.success("Original extraction accepted and validated")
      setSelectedValidationId(null)
      setSnapshotOriginal(null)
    }
  }

  const handleValidationDecisionNew = async () => {
    if (!selectedValidationId || !selectedNewExtraction) return
    const result = await confirmExtraction({
      chunkId: selectedValidationId,
      data: selectedNewExtraction as unknown as Record<string, unknown>,
      action: "accept",
    })
    if (result.success) {
      toast.success("New extraction accepted and validated")
      setSelectedValidationId(null)
      setSnapshotOriginal(null)
    }
  }

  const handleReject = async () => {
    if (!selectedValidationId) return
    const result = await confirmExtraction({
      chunkId: selectedValidationId,
      action: "reject",
    })
    if (result.success) {
      toast.info("Chunk rejected, moved back to not-processed")
      setSelectedValidationId(null)
      setSnapshotOriginal(null)
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

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="extraction">Extraction</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
        </TabsList>

        <TabsContent value="extraction" className="space-y-6 mt-4">
          {!hasAvailableTokens && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>
                {allTokens.length === 0
                  ? "No API tokens found. Add tokens in Settings."
                  : rateLimitedTokens.length > 0
                    ? `All tokens rate-limited. Next available in ~${Math.ceil(minCooldownRemaining / 60)}m.`
                    : `All ${allTokens.length} token(s) exhausted or inactive. Update in Settings.`}
              </span>
            </div>
          )}

          {hasAvailableTokens && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                {availableTokens.length}/{allTokens.length} tokens available
              </Badge>
              {rateLimitedTokens.length > 0 && (
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <Clock className="h-3 w-3" />
                  {rateLimitedTokens.length} rate-limited
                </span>
              )}
            </div>
          )}

          <ExtractionControls
            provider={provider}
            strategy={strategy}
            selectedCount={selectedIds.length}
            onProviderChange={setProvider}
            onStrategyChange={setStrategy}
            onStartExtraction={handleStartExtraction}
            isProcessing={isProcessing}
            isDisabled={!hasAvailableTokens}
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
            hasAvailableTokens={hasAvailableTokens}
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

          <ValidationCompare
            original={(snapshotOriginal || selectedOriginal) as any}
            newExtraction={selectedNewExtraction as any}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
