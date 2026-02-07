"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExtractionControls } from "@/components/extraction/extraction-controls"
import { ChunkSelector } from "@/components/extraction/chunk-selector"
import { ExtractionProgress } from "@/components/extraction/extraction-progress"
import { ExtractionResults } from "@/components/extraction/extraction-results"
import { ValidationQueue } from "@/components/extraction/validation-queue"
import { ValidationCompare } from "@/components/extraction/validation-compare"
import { ValidationActions } from "@/components/extraction/validation-actions"
import { useChunks, useExtractedData, processChunk, confirmExtraction, mutateChunks, mutateExtracted } from "@/lib/hooks/use-api"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

export default function ExtractionPage() {
  const [provider, setProvider] = useState("auto")
  const [strategy, setStrategy] = useState("failover")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0, tokens: 0, elapsed: 0 })

  // Validation state
  const [selectedValidationId, setSelectedValidationId] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  const { data: chunksData, isLoading: chunksLoading } = useChunks({ limit: 500 })
  const { data: extractedRes } = useExtractedData({ limit: 100 })

  const allChunks = chunksData?.chunks || []
  const notProcessedChunks = allChunks.filter((c) => c.status === "not-processed")
  const validationChunks = allChunks.filter((c) => c.status === "requires-validation")
  const extractedData = extractedRes?.data || []

  const handleStartExtraction = async () => {
    if (selectedIds.length === 0) {
      toast.error("Select at least one chunk")
      return
    }
    setIsProcessing(true)
    setProgress({ current: 0, total: selectedIds.length, tokens: 0, elapsed: 0 })
    toast.info(`Starting extraction of ${selectedIds.length} chunks...`)

    for (let i = 0; i < selectedIds.length; i++) {
      const chunk = allChunks.find((c) => c._id === selectedIds[i])
      if (!chunk) continue

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
          elapsed: p.elapsed + 2,
        }))

        if (!result.success) {
          toast.error(`Chunk ${chunk.chunkIndex}: ${result.error}`)
        }
      } catch {
        toast.error(`Failed to process chunk ${chunk.chunkIndex}`)
      }
    }

    setIsProcessing(false)
    setSelectedIds([])
    mutateChunks()
    mutateExtracted()
    toast.success("Extraction complete!")
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
          <ExtractionControls
            provider={provider}
            strategy={strategy}
            selectedCount={selectedIds.length}
            onProviderChange={setProvider}
            onStrategyChange={setStrategy}
            onStartExtraction={handleStartExtraction}
            isProcessing={isProcessing}
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
              onCancel={() => {
                setIsProcessing(false)
                toast.info("Extraction cancelled")
              }}
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
