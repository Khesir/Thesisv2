"use client"

import { Button } from "@/components/ui/button"
import { Play, Check, RefreshCw, X, SkipForward } from "lucide-react"

interface ValidationActionsProps {
  hasSelection: boolean
  hasNewExtraction: boolean
  isValidating: boolean
  hasAvailableTokens?: boolean
  onRunValidation: () => void
  onAcceptOriginal: () => void
  onAcceptNew: () => void
  onReject: () => void
  onSkip: () => void
}

export function ValidationActions({
  hasSelection,
  hasNewExtraction,
  isValidating,
  hasAvailableTokens = true,
  onRunValidation,
  onAcceptOriginal,
  onAcceptNew,
  onReject,
  onSkip,
}: ValidationActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={onRunValidation}
        disabled={!hasSelection || isValidating || !hasAvailableTokens}
        title={!hasAvailableTokens ? "No available tokens for validation" : ""}
      >
        {isValidating ? (
          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Play className="mr-2 h-4 w-4" />
        )}
        Run Validation
      </Button>

      <Button
        variant="outline"
        onClick={onAcceptOriginal}
        disabled={!hasNewExtraction}
      >
        <Check className="mr-2 h-4 w-4" />
        Accept Original
      </Button>

      <Button
        variant="outline"
        onClick={onAcceptNew}
        disabled={!hasNewExtraction}
      >
        <Check className="mr-2 h-4 w-4" />
        Accept New
      </Button>

      <Button
        variant="destructive"
        onClick={onReject}
        disabled={!hasSelection}
      >
        <X className="mr-2 h-4 w-4" />
        Reject
      </Button>

      <Button variant="ghost" onClick={onSkip} disabled={!hasSelection}>
        <SkipForward className="mr-2 h-4 w-4" />
        Skip
      </Button>
    </div>
  )
}
