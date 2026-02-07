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
  provider: string
  strategy: string
  selectedCount: number
  onProviderChange: (v: string) => void
  onStrategyChange: (v: string) => void
  onStartExtraction: () => void
  isProcessing: boolean
}

export function ExtractionControls({
  provider,
  strategy,
  selectedCount,
  onProviderChange,
  onStrategyChange,
  onStartExtraction,
  isProcessing,
}: ExtractionControlsProps) {
  return (
    <Card>
      <CardContent className="flex flex-wrap items-end gap-4 pt-6">
        <div className="space-y-2">
          <Label>Provider</Label>
          <Select value={provider} onValueChange={onProviderChange}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="anthropic">Claude</SelectItem>
              <SelectItem value="google">Gemini</SelectItem>
              <SelectItem value="ollama">Ollama</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Strategy</Label>
          <Select value={strategy} onValueChange={onStrategyChange}>
            <SelectTrigger className="w-[170px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="failover">Failover</SelectItem>
              <SelectItem value="round-robin">Round Robin</SelectItem>
              <SelectItem value="cost-optimized">Cost Optimized</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            Selected: <strong>{selectedCount}</strong>
          </span>
          <Button
            onClick={onStartExtraction}
            disabled={selectedCount === 0 || isProcessing}
          >
            <Play className="mr-2 h-4 w-4" />
            Start Extraction
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
