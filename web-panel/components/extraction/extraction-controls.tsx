"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Play, X } from "lucide-react"

interface ExtractionControlsProps {
  selectedCount: number
  onStartExtraction: () => void
  onMassReject?: () => void
  isProcessing: boolean
  isDisabled?: boolean
}

export function ExtractionControls({
  selectedCount,
  onStartExtraction,
  onMassReject,
  isProcessing,
  isDisabled = false,
}: ExtractionControlsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div className="space-y-2">
            <Label className="text-muted-foreground">Strategy</Label>
            <Select value="failover" disabled>
              <SelectTrigger
                className="w-[170px] opacity-50 cursor-not-allowed"
                title="Strategy is not available — requires token rotation system (in development)"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="failover">Failover</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              Selected: <strong>{selectedCount}</strong>
            </span>
            <Button
              onClick={onStartExtraction}
              disabled={selectedCount === 0 || isProcessing || isDisabled}
            >
              <Play className="mr-2 h-4 w-4" />
              Start Extraction
            </Button>
            {onMassReject && (
              <Button
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
                disabled={selectedCount === 0 || isProcessing}
              >
                <X className="mr-2 h-4 w-4" />
                Reject Selected
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject {selectedCount} chunk{selectedCount !== 1 ? "s" : ""}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently reject the selected chunk{selectedCount !== 1 ? "s" : ""} and remove any associated extracted data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { onMassReject?.(); setConfirmOpen(false) }}
            >
              Reject {selectedCount} chunk{selectedCount !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
