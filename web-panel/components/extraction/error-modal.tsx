"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertCircle, Copy, X } from "lucide-react"
import { toast } from "sonner"

interface ErrorModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title?: string
  error: string
  details?: Record<string, unknown>
  requestId?: string
}

export function ErrorModal({
  open,
  onOpenChange,
  title = "Error",
  error,
  details,
  requestId,
}: ErrorModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    const fullError = [
      error,
      details && Object.keys(details).length > 0
        ? `\n\nDetails:\n${JSON.stringify(details, null, 2)}`
        : "",
      requestId ? `\n\nRequest ID: ${requestId}` : "",
    ]
      .join("")

    navigator.clipboard.writeText(fullError)
    setCopied(true)
    toast.success("Error copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
              <DialogTitle>{title}</DialogTitle>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {requestId && (
            <DialogDescription className="text-xs text-muted-foreground">
              Request ID: {requestId}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Main Error Message */}
          <div className="bg-destructive/5 border border-destructive/20 rounded-md p-3">
            <p className="text-sm font-medium text-destructive">{error}</p>
          </div>

          {/* Details Section */}
          {details && Object.keys(details).length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Details:</p>
              <div className="bg-muted/50 border border-border rounded-md p-3 font-mono text-xs overflow-x-auto">
                <pre>{JSON.stringify(details, null, 2)}</pre>
              </div>
            </div>
          )}

          {/* Help Text */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md p-3 space-y-2">
            <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
              Troubleshooting steps:
            </p>
            <ul className="text-xs text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
              <li>Check your API token is valid and has remaining quota</li>
              <li>Verify the content is properly formatted</li>
              <li>Try a different extraction strategy (failover, round-robin)</li>
              <li>Copy the error details and check server logs</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" />
            {copied ? "Copied" : "Copy Error"}
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
