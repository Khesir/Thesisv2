"use client"

import { useState, useCallback } from "react"
import { ValidationQueue } from "@/components/extraction/validation-queue"
import { ValidationCompare } from "@/components/extraction/validation-compare"
import { ValidationActions } from "@/components/extraction/validation-actions"
import { TokenInput } from "@/components/extraction/token-input"
import { ChunkDetailDialog } from "@/components/processing/chunk-detail-dialog"
import { useToken } from "@/lib/context/token-context"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

import {
  useChunks,
  useExtractedData,
  processChunk,
  confirmExtraction,
  mutateChunks,
  mutateExtracted,
  mutateValidationResults,
} from "@/lib/hooks/use-api"
import type { Chunk } from "@/lib/types/chunk"

export default function ValidationPage() {
  const { apiKey, provider, tokenStatus, isTesting, handleTokenChange, handleProviderChange, handleTestToken, markQuotaExhausted, incrementQuotaUsed } = useToken()

  // Validation state
  const [selectedValidationId, setSelectedValidationId] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [snapshotOriginal, setSnapshotOriginal] = useState<Record<string, unknown> | null>(null)

  // Metrics state (from ValidationCompare callbacks)
  const [fieldConsistency, setFieldConsistency] = useState<Record<string, boolean>>({})
  const [consistencyScore, setConsistencyScore] = useState(0)
  const [fieldAccuracy, setFieldAccuracy] = useState<Record<string, boolean>>({})
  const [accuracyScore, setAccuracyScore] = useState(0)

  // View chunk dialog
  const [viewChunk, setViewChunk] = useState<Chunk | null>(null)

  const { data: chunksData, isLoading: chunksLoading } = useChunks({ limit: 500 })
  const { data: extractedRes } = useExtractedData({ limit: 500 })

  const allChunks = chunksData?.chunks || []
  const validationChunks = allChunks.filter((c) => c.status === "requires-validation")
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

  // Derived: extractions for selected chunk
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
  const selectedNewExtraction = selectedChunkExtractions.length > 1
    ? selectedChunkExtractions[selectedChunkExtractions.length - 1]
    : null

  // Source text for the selected chunk
  const selectedChunk = selectedValidationId
    ? allChunks.find((c) => c._id === selectedValidationId)
    : null

  // Callbacks from ValidationCompare
  const handleConsistencyChange = useCallback((c: Record<string, boolean>, score: number) => {
    setFieldConsistency(c)
    setConsistencyScore(score)
  }, [])

  const handleAccuracyChange = useCallback((a: Record<string, boolean>, score: number) => {
    setFieldAccuracy(a)
    setAccuracyScore(score)
  }, [])

  // Validation handlers
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
        incrementQuotaUsed()
        toast.success("Validation extraction complete - review both versions")
        await mutateExtracted()
      } else {
        const errMsg = result.error || "Validation failed"
        if (isQuotaError(errMsg)) markQuotaExhausted()
        else toast.error(errMsg)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (isQuotaError(msg)) markQuotaExhausted()
      else toast.error(`Validation failed: ${msg}`)
    } finally {
      setIsValidating(false)
    }
  }

  // Save validation result + accept extraction
  const saveAndAccept = async (dataToAccept: Record<string, unknown>, extractedDataId: string) => {
    try {
      // 1. Accept the extraction (existing flow)
      const confirmResult = await confirmExtraction({
        chunkId: selectedValidationId!,
        data: dataToAccept,
        action: "accept",
      })
      if (!confirmResult.success) {
        toast.error(`Failed to accept: ${confirmResult.error || "Server returned an error"}`)
        return
      }

      // 2. Save validation metrics
      await fetch("/api/validation-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          extractedDataId,
          chunkId: selectedValidationId,
          cropName: (dataToAccept as Record<string, unknown>).cropName || "Unknown",
          fieldConsistency,
          fieldAccuracy,
        }),
      })

      mutateValidationResults()
      toast.success("Extraction accepted with validation metrics saved")
      setSelectedValidationId(null)
      setSnapshotOriginal(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(`Failed: ${msg}`)
    }
  }

  const handleAcceptOriginal = async () => {
    if (!selectedValidationId || !selectedOriginal) return
    const dataToSend = snapshotOriginal || (selectedOriginal as unknown as Record<string, unknown>)
    await saveAndAccept(dataToSend, selectedOriginal._id)
  }

  const handleAcceptNew = async () => {
    if (!selectedValidationId || !selectedNewExtraction) return
    await saveAndAccept(
      selectedNewExtraction as unknown as Record<string, unknown>,
      selectedNewExtraction._id,
    )
  }

  const handleReject = async () => {
    if (!selectedValidationId) return
    try {
      const result = await confirmExtraction({
        chunkId: selectedValidationId,
        action: "reject-permanent",
      })
      if (result.success) {
        toast.info("Chunk rejected permanently")
        mutateChunks()
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
        <h1 className="text-3xl font-bold">Validation</h1>
        <Skeleton className="h-64" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Validation</h1>

      <TokenInput
        token={apiKey}
        onTokenChange={handleTokenChange}
        provider={provider}
        onProviderChange={handleProviderChange}
        tokenStatus={tokenStatus}
        onTest={handleTestToken}
        isTesting={isTesting}
        disabled={isValidating}
      />

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
        onAcceptOriginal={handleAcceptOriginal}
        onAcceptNew={handleAcceptNew}
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
        sourceText={selectedChunk?.content}
        onConsistencyChange={handleConsistencyChange}
        onAccuracyChange={handleAccuracyChange}
      />

      <ChunkDetailDialog
        chunk={viewChunk}
        open={!!viewChunk}
        onOpenChange={(open) => !open && setViewChunk(null)}
      />
    </div>
  )
}
