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
import { useChunks, useExtractedData, processChunk, confirmExtraction, mutateChunks, mutateExtracted, useTokens } from "@/lib/hooks/use-api"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
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

  const { data: chunksData, isLoading: chunksLoading } = useChunks({ limit: 50 })
  const { data: extractedRes } = useExtractedData({ limit: 50 })
  const { data: tokensData } = useTokens()

  const allChunks = chunksData?.chunks || []
  const notProcessedChunks = allChunks.filter((c) => c.status === "not-processed")
  const validationChunks = allChunks.filter((c) => c.status === "requires-validation")
  const extractedData = extractedRes?.data || []

  // Calculate available tokens
  const allTokens = tokensData?.tokens || []
  const availableTokens = allTokens.filter((t) => t.isActive && (t.usageLimit === null || t.usageCount < t.usageLimit))
  const exhaustedTokens = allTokens.filter((t) => !t.isActive || (t.usageLimit !== null && t.usageCount >= t.usageLimit))
  const hasAvailableTokens = availableTokens.length > 0

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

    if (failureCount === 0 && successCount > 0) {
      toast.success(`All ${successCount} chunks extracted successfully!`)
    } else if (successCount === 0) {
      toast.error(`All ${failureCount} chunks failed`)
    } else {
      toast.info(`✓ ${successCount} succeeded, ✗ ${failureCount} failed`)
    }
  }

  const selectedOriginal = selectedValidationId
    ? extractedData.find((d) => {
        const chunkId = typeof d.chunkId === "string" ? d.chunkId : d.chunkId?._id
        return chunkId === selectedValidationId
      }) || null
    : null

  const handleRunValidation = async () => {
    if (!selectedValidationId) return
    setIsValidating(true)
    toast.info("Running re-extraction for validation...")

    const chunk = allChunks.find((c) => c._id === selectedValidationId)
    if (!chunk) {
      setIsValidating(false)
      return
    }

    try {
      const result = await processChunk({
        content: chunk.content,
        provider: provider === "auto" ? undefined : provider,
        strategy,
      })
      if (result.success) {
        toast.success("Validation extraction complete")
      } else {
        toast.error(result.error || "Validation failed")
      }
    } catch {
      toast.error("Validation failed")
    } finally {
      setIsValidating(false)
    }
  }

  const handleAccept = async () => {
    if (!selectedValidationId || !selectedOriginal) return
    const result = await confirmExtraction({
      chunkId: selectedValidationId,
      data: selectedOriginal as unknown as Record<string, unknown>,
      action: "accept",
    })
    if (result.success) {
      toast.success("Extraction accepted and validated")
      setSelectedValidationId(null)
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

      <Tabs defaultValue="extraction">
        <TabsList>
          <TabsTrigger value="extraction">Extraction</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
        </TabsList>

        <TabsContent value="extraction" className="space-y-6 mt-4">
          {!hasAvailableTokens && allTokens.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No Available Tokens</AlertTitle>
              <AlertDescription>
                You have {allTokens.length} token(s) total, but {exhaustedTokens.length} are exhausted or inactive.
                Please add new tokens or increase usage limits in Settings before extracting.
              </AlertDescription>
            </Alert>
          )}

          {allTokens.length === 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No API Tokens Found</AlertTitle>
              <AlertDescription>
                You need to add at least one API token in Settings before you can start extraction.
              </AlertDescription>
            </Alert>
          )}

          {hasAvailableTokens && (
            <Alert className="border-green-200 bg-green-50">
              <AlertCircle className="h-4 w-4 text-green-700" />
              <AlertTitle className="text-green-900">Available Tokens</AlertTitle>
              <AlertDescription className="text-green-800">
                {availableTokens.length}/{allTokens.length} tokens available for extraction
                {exhaustedTokens.length > 0 && ` (${exhaustedTokens.length} exhausted or inactive)`}
              </AlertDescription>
            </Alert>
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

          <ExtractionResults results={extractedData.slice(0, 10) as unknown as import("@/lib/types/extracted-data").ExtractedData[]} chunks={allChunks} />
        </TabsContent>

        <TabsContent value="validation" className="space-y-6 mt-4">
          <ValidationQueue
            chunks={validationChunks}
            allChunks={allChunks}
            selectedId={selectedValidationId}
            onSelect={setSelectedValidationId}
          />

          <ValidationActions
            hasSelection={!!selectedValidationId}
            hasNewExtraction={false}
            isValidating={isValidating}
            onRunValidation={handleRunValidation}
            onAcceptOriginal={handleAccept}
            onAcceptNew={() => toast.success("New extraction accepted")}
            onReject={handleReject}
            onSkip={() => {
              const idx = validationChunks.findIndex((c) => c._id === selectedValidationId)
              const next = validationChunks[idx + 1]
              setSelectedValidationId(next?._id || null)
            }}
          />

          <ValidationCompare original={selectedOriginal as unknown as import("@/lib/types/extracted-data").ExtractedData | null} newExtraction={null} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
