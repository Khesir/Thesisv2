"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Database, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useUser } from "@/lib/context/UserProvider"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { detectDuplicates } from "@/lib/utils/variety-detection"

interface CreateMergedDataButtonProps {
  extractedData: any[]
  onSuccess?: () => void
}

export function CreateMergedDataButton({
  extractedData,
  onSuccess,
}: CreateMergedDataButtonProps) {
  const { username, setUsername } = useUser()
  const [open, setOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [tempUsername, setTempUsername] = useState(username || "")
  const [duplicateGroups, setDuplicateGroups] = useState<any[]>([])

  // Filter validated data with cropName
  const validatedData = extractedData.filter(
    (d) => d.validatedAt && d.cropName
  )

  const handleOpenDialog = () => {
    if (!username) {
      toast.error("Please set your name first")
      setOpen(true)
      return
    }

    // Detect duplicates
    const groups = detectDuplicates(validatedData)
    setDuplicateGroups(groups)
    setOpen(true)
  }

  const handleCreateMergedData = async () => {
    if (!tempUsername.trim()) {
      toast.error("Please enter your name")
      return
    }

    // Save username
    setUsername(tempUsername)

    setIsProcessing(true)

    try {
      if (duplicateGroups.length > 0) {
        // Has duplicates - merge them
        toast.info(`Creating merged data with ${duplicateGroups.length} merge groups...`)

        for (const group of duplicateGroups) {
          const sourceDocIds = group.documents.map((d: any) => d.id)

          // Build merge decision
          const varieties = group.documents
            .filter((d: any) => d.isVariety)
            .map((d: any) => ({
              name: d.cropName,
              sourceDocId: d.id,
              varietyType: d.varietyType,
            }))

          const mergeDecision = {
            cropName: group.suggestedParent,
            varieties,
            alternativeNames: [],
          }

          const response = await fetch("/api/merged-data/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceDocumentIds: sourceDocIds,
              validatedBy: tempUsername,
              mergeDecision,
            }),
          })

          const result = await response.json()

          if (!result.success) {
            toast.error(`Failed to merge ${group.baseCropName}: ${result.error}`)
          } else {
            toast.success(
              `Merged ${group.baseCropName}: ${result.varietyIds.length} varieties created`
            )
          }
        }
      } else {
        // No duplicates - create individual records
        toast.info(`Creating ${validatedData.length} individual merged records...`)

        for (const data of validatedData) {
          const response = await fetch("/api/merged-data/merge", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sourceDocumentIds: [data._id],
              validatedBy: tempUsername,
            }),
          })

          const result = await response.json()

          if (!result.success) {
            toast.error(`Failed to create ${data.cropName}: ${result.error}`)
          }
        }

        toast.success(`Created ${validatedData.length} merged records`)
      }

      setOpen(false)
      onSuccess?.()
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      toast.error(`Failed to create merged data: ${msg}`)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <>
      <Button onClick={handleOpenDialog} disabled={validatedData.length === 0}>
        <Database className="mr-2 h-4 w-4" />
        Create Merged Data ({validatedData.length} validated)
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Merged Data</DialogTitle>
            <DialogDescription>
              Review validated data and create production-ready merged records
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Username input */}
            <div className="space-y-2">
              <Label htmlFor="username">Your Name (for validation tracking)</Label>
              <Input
                id="username"
                value={tempUsername}
                onChange={(e) => setTempUsername(e.target.value)}
                placeholder="Enter your name..."
              />
              <p className="text-xs text-muted-foreground">
                This will be stored as validatedBy in the merged data
              </p>
            </div>

            {/* Summary */}
            <div className="rounded-lg border p-4 space-y-2">
              <h4 className="font-semibold">Summary</h4>
              <ul className="text-sm space-y-1">
                <li>✓ Validated records: {validatedData.length}</li>
                <li>
                  {duplicateGroups.length > 0
                    ? `⚠️ Detected ${duplicateGroups.length} duplicate groups (will merge with varieties)`
                    : "✓ No duplicates detected (will create individual records)"}
                </li>
              </ul>
            </div>

            {/* Duplicate groups preview */}
            {duplicateGroups.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Merge Preview</h4>
                <div className="space-y-2 text-sm">
                  {duplicateGroups.map((group, idx) => (
                    <div key={idx} className="rounded border p-2">
                      <div className="font-medium">
                        {group.suggestedParent}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {group.documents.length} documents →{" "}
                        {group.suggestedVarieties.length > 0
                          ? `1 parent + ${group.suggestedVarieties.length} varieties`
                          : "1 merged record"}
                      </div>
                      {group.suggestedVarieties.length > 0 && (
                        <div className="text-xs mt-1">
                          Varieties: {group.suggestedVarieties.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button onClick={handleCreateMergedData} disabled={isProcessing || !tempUsername.trim()}>
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Merged Data"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
