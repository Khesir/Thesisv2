"use client"

import { useState, useEffect } from "react"
import { FileUpload } from "@/components/processing/file-upload"
import { ChunkConfig } from "@/components/processing/chunk-config"
import { ChunksTable } from "@/components/processing/chunks-table"
import { ProcessingProgress } from "@/components/processing/processing-progress"
import { useChunks, uploadPDF, mutateChunks } from "@/lib/hooks/use-api"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { AlertCircle, X } from "lucide-react"

export default function ProcessingPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [chunkSize, setChunkSize] = useState(1000)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [stage, setStage] = useState<"uploading" | "extracting" | "chunking" | "saving" | "done">("uploading")
  const [error, setError] = useState<{ message: string; traceback?: string } | null>(null)

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
    setError(null)
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
        setError({ message: result.error || "Upload failed", traceback: result.traceback })
      }
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : "Upload failed" })
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

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span className="font-medium">Processing failed</span>
              </div>
              <button onClick={() => setError(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-destructive">{error.message}</p>
            {error.traceback && (
              <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
                {error.traceback}
              </pre>
            )}
          </CardContent>
        </Card>
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
