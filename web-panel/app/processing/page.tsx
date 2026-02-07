"use client"

import { useState } from "react"
import { FileUpload } from "@/components/processing/file-upload"
import { ChunkConfig } from "@/components/processing/chunk-config"
import { ChunksTable } from "@/components/processing/chunks-table"
import { useChunks, uploadPDF, mutateChunks } from "@/lib/hooks/use-api"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

export default function ProcessingPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [chunkSize, setChunkSize] = useState(1000)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  const { data, isLoading } = useChunks({ limit: 200 })
  const chunks = data?.chunks || []

  const handleCreateChunks = async () => {
    if (!selectedFile) {
      toast.error("Please select a PDF file first")
      return
    }
    setUploading(true)
    try {
      const result = await uploadPDF(selectedFile, chunkSize)
      if (result.success) {
        toast.success(`Created ${result.totalChunks} chunks from ${selectedFile.name}`)
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
