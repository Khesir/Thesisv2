"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"

interface ChunkConfigProps {
  chunkSize: number
  onChunkSizeChange: (size: number) => void
  onCreateChunks: () => void
  disabled: boolean
}

export function ChunkConfig({
  chunkSize,
  onChunkSizeChange,
  onCreateChunks,
  disabled,
}: ChunkConfigProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Chunk Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Chunk Size</Label>
            <span className="text-sm font-medium">{chunkSize} tokens</span>
          </div>
          <Slider
            value={[chunkSize]}
            onValueChange={(v) => onChunkSizeChange(v[0])}
            min={500}
            max={2000}
            step={100}
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>500</span>
            <span>2000</span>
          </div>
          <p className="text-xs text-muted-foreground italic">
            Recommended: 800-1200 tokens for optimal LLM extraction
          </p>
        </div>
        <Button onClick={onCreateChunks} disabled={disabled} className="w-full">
          Create Chunks
        </Button>
      </CardContent>
    </Card>
  )
}
