"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X } from "lucide-react"
import { Chunk } from "@/lib/types/chunk"

interface ChunkDetailDialogProps {
  chunk: Chunk | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onReject?: (chunkId: string) => void
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
  onReject,
}: ChunkDetailDialogProps) {
  if (!chunk) return null

  const handleReject = () => {
    onReject?.(chunk._id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col max-h-[80vh]">
        <DialogHeader className="shrink-0 overflow-hidden">
          <DialogTitle className="overflow-hidden text-ellipsis whitespace-nowrap pr-6">
            Chunk #{chunk.chunkIndex} - {chunk.source}
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-4 text-sm shrink-0">
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
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden rounded-md border p-4 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding">
          <pre className="whitespace-pre-wrap text-sm break-words">{chunk.content}</pre>
        </div>
        {onReject && (
          <DialogFooter className="shrink-0">
            <Button variant="destructive" onClick={handleReject}>
              <X className="mr-2 h-4 w-4" />
              Reject Chunk
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
