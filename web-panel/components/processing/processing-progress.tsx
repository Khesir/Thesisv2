"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Loader2, FileText, Clock, CheckCircle2 } from "lucide-react"

interface ProcessingProgressProps {
  fileName: string
  elapsedSeconds: number
  stage: "uploading" | "extracting" | "chunking" | "saving" | "done"
}

const stageLabels: Record<string, string> = {
  uploading: "Uploading PDF...",
  extracting: "Extracting text from PDF...",
  chunking: "Creating chunks...",
  saving: "Saving to database...",
  done: "Processing complete!",
}

const stageProgress: Record<string, number> = {
  uploading: 15,
  extracting: 40,
  chunking: 65,
  saving: 85,
  done: 100,
}

export function ProcessingProgress({ fileName, elapsedSeconds, stage }: ProcessingProgressProps) {
  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60
  const isDone = stage === "done"

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isDone ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            <span className="text-sm font-medium">{stageLabels[stage]}</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>{minutes}m {String(seconds).padStart(2, "0")}s</span>
          </div>
        </div>

        <Progress value={stageProgress[stage]} />

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>{fileName}</span>
        </div>
      </CardContent>
    </Card>
  )
}
