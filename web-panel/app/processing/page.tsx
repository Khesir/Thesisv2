"use client"

import { useState, useEffect } from "react"
import { FileUpload } from "@/components/processing/file-upload"
import { ChunkConfig } from "@/components/processing/chunk-config"
import { ChunksTable } from "@/components/processing/chunks-table"
import { ProcessingProgress } from "@/components/processing/processing-progress"
import { useChunks, uploadPDF, mutateChunks } from "@/lib/hooks/use-api"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

export default function ProcessingPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [chunkSize, setChunkSize] = useState(1000)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [stage, setStage] = useState<"uploading" | "extracting" | "chunking" | "saving" | "done">("uploading")

  const { data, isLoading } = useChunks({ limit: 200 })
  const chunks = data?.chunks || []

  // Elapsed time timer
  useEffect(() => {
    if (!uploading) return

    setElapsed(0)
    const timer = setInterval(() => {
      setElapsed((e) => e + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [uploading])

  // Simulate stage progression based on elapsed time
  // (actual stages happen server-side in one request, so we estimate)
  useEffect(() => {
    if (!uploading) return

    if (elapsed < 2) setStage("uploading")
    else if (elapsed < 8) setStage("extracting")
    else if (elapsed < 15) setStage("chunking")
    else setStage("saving")
  }, [elapsed, uploading])

  const handleCreateChunks = async () => {
    if (!selectedFile) {
      toast.error("Please select a PDF file first")
      return
    }
    setUploading(true)
    setStage("uploading")
    try {
      const result = await uploadPDF(selectedFile, chunkSize)
      if (result.success) {
        setStage("done")
        toast.success(`Created ${result.totalChunks} chunks from ${selectedFile.name}`)
        // Keep progress visible briefly before clearing
        await new Promise((r) => setTimeout(r, 1500))
        setSelectedFile(null)
        mutateChunks()
      } else {
        toast.error(result.error || "Upload failed")
      }
    } catch {
      toast.error("Upload failed")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Processing Book</h1>

      <FileUpload onFileSelect={setSelectedFile} selectedFile={selectedFile} />

      <ChunkConfig
        chunkSize={chunkSize}
        onChunkSizeChange={setChunkSize}
        onCreateChunks={handleCreateChunks}
        disabled={!selectedFile || uploading}
      />

      {uploading && selectedFile && (
        <ProcessingProgress
          fileName={selectedFile.name}
          elapsedSeconds={elapsed}
          stage={stage}
        />
      )}

      {/* Show done state briefly after completion */}
      {!uploading && stage === "done" && selectedFile && (
        <ProcessingProgress
          fileName={selectedFile.name}
          elapsedSeconds={elapsed}
          stage="done"
        />
      )}

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <ChunksTable
          chunks={chunks}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
        />
      )}
    </div>
  )
}
