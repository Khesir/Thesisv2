"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Play } from "lucide-react"

interface ExtractionControlsProps {
  selectedCount: number
  onStartExtraction: () => void
  isProcessing: boolean
  isDisabled?: boolean
}

export function ExtractionControls({
  selectedCount,
  onStartExtraction,
  isProcessing,
  isDisabled = false,
}: ExtractionControlsProps) {
  return (
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

        <div className="flex items-center gap-4">
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
        </div>
      </CardContent>
    </Card>
  )
}
