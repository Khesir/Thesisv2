"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { type ExtractedDataResponse } from "@/lib/entities/extracted-data"

interface ValidationDecisionDialogProps {
  open: boolean
  original: ExtractedDataResponse | null
  newExtraction: ExtractedDataResponse | null
  consistency?: number
  onSelectOriginal: () => void
  onSelectNew: () => void
  onCancel: () => void
}

export function ValidationDecisionDialog({
  open,
  original,
  newExtraction,
  consistency,
  onSelectOriginal,
  onSelectNew,
  onCancel,
}: ValidationDecisionDialogProps) {
  if (!original || !newExtraction) return null

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose Extraction Version</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            {consistency !== undefined && (
              <div className="flex items-center gap-2 mb-3">
                <span>Consistency:</span>
                <Badge
                  variant={consistency >= 80 ? "default" : "secondary"}
                  className={consistency >= 80 ? "bg-green-600" : "bg-yellow-600"}
                >
                  {consistency}% Match
                </Badge>
              </div>
            )}
            <p>Review both versions and choose which extraction to keep and mark as processed.</p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-h-96">
            {/* Original */}
            <div className="space-y-2 border rounded p-3 bg-muted/50">
              <div className="text-sm font-semibold">Original Extraction</div>
              <div className="max-h-72 overflow-auto text-xs font-mono whitespace-pre-wrap break-words">
                {JSON.stringify(original, null, 2)}
              </div>
            </div>

            {/* New */}
            <div className="space-y-2 border rounded p-3 bg-muted/50">
              <div className="text-sm font-semibold">New Extraction</div>
              <div className="max-h-72 overflow-auto text-xs font-mono whitespace-pre-wrap break-words">
                {JSON.stringify(newExtraction, null, 2)}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={onSelectOriginal}>
            Keep Original
          </Button>
          <Button onClick={onSelectNew}>
            Use New Extraction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
