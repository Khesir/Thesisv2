"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Chunk } from "@/lib/types/chunk"

interface ChunkDetailDialogProps {
  chunk: Chunk | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  processed: "default",
  "requires-validation": "secondary",
  processing: "outline",
  "not-processed": "outline",
  rejected: "destructive",
}

export function ChunkDetailDialog({
  chunk,
  open,
  onOpenChange,
}: ChunkDetailDialogProps) {
  if (!chunk) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Chunk #{chunk.chunkIndex} - {chunk.source}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Status: </span>
              <Badge variant={statusVariant[chunk.status]}>{chunk.status}</Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Tokens: </span>
              <span className="font-medium">{chunk.tokenCount}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Created: </span>
              <span>{new Date(chunk.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
          <ScrollArea className="h-[400px] rounded-md border p-4">
            <pre className="whitespace-pre-wrap text-sm">{chunk.content}</pre>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
