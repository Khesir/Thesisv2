"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"

interface ValidationMetricsProps {
  totalValidated: number
  rejectedChunks: number
  avgAccuracy: number
  avgConsistency: number
}

function MetricBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

export function ValidationMetrics({
  totalValidated,
  rejectedChunks,
  avgAccuracy,
  avgConsistency,
}: ValidationMetricsProps) {
  // Precision: of all extracted fields, what % are correct (accuracy)
  const precision = avgAccuracy

  // Recall: of all fields, what % are consistently found across re-extractions
  const recall = avgConsistency

  // F1: harmonic mean of precision and recall
  const f1 =
    precision + recall > 0
      ? Math.round((2 * precision * recall) / (precision + recall))
      : 0

  const noData = totalValidated === 0

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Validation Metrics</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">{totalValidated} validated</Badge>
            {rejectedChunks > 0 && (
              <Badge variant="destructive">{rejectedChunks} rejected</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {noData ? (
          <p className="text-muted-foreground text-center py-4">No validation results yet</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Accuracy</span>
                <span className="font-semibold">{avgAccuracy}%</span>
              </div>
              <MetricBar value={avgAccuracy} color="bg-green-500" />
              <p className="text-xs text-muted-foreground">
                Correctly extracted fields per review
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Consistency</span>
                <span className="font-semibold">{avgConsistency}%</span>
              </div>
              <MetricBar value={avgConsistency} color="bg-blue-500" />
              <p className="text-xs text-muted-foreground">
                Fields matching across re-extractions
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Precision</span>
                <span className="font-semibold">{precision}%</span>
              </div>
              <MetricBar value={precision} color="bg-violet-500" />
              <p className="text-xs text-muted-foreground">
                Correct extractions out of all extracted
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Recall</span>
                <span className="font-semibold">{recall}%</span>
              </div>
              <MetricBar value={recall} color="bg-orange-500" />
              <p className="text-xs text-muted-foreground">
                Fields consistently found across runs
              </p>
            </div>

            <div className="col-span-full border-t pt-4 flex items-center justify-between text-sm">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground">F1 Score</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-72">
                    <p className="font-medium mb-1">Harmonic mean of Precision &amp; Recall</p>
                    <p className="text-xs text-muted-foreground">
                      Balances both metrics into one score. Punishes imbalance — a high recall but low precision (or vice versa) will pull F1 down significantly. Use this to compare extraction quality across LLM providers or strategies.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Example: Precision 90% + Recall 50% → F1 = 64%, not 70%.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <span className="text-lg font-bold">{f1}%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
