"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ExtractedData } from "@/lib/types/extracted-data"

interface ValidationCompareProps {
  original: ExtractedData | null
  newExtraction: ExtractedData | null
}

interface FieldRowProps {
  label: string
  original: string
  newValue: string
}

function FieldRow({ label, original, newValue }: FieldRowProps) {
  const isDiff = original !== newValue
  return (
    <div className="grid grid-cols-[120px_1fr_1fr] gap-2 py-1 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span>{original || "-"}</span>
      <span className={isDiff ? "text-red-600 dark:text-red-400 font-medium" : ""}>
        {newValue || "-"}
        {isDiff && " *"}
      </span>
    </div>
  )
}

export function ValidationCompare({
  original,
  newExtraction,
}: ValidationCompareProps) {
  if (!original) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Select a chunk from the queue and run validation to compare results
        </CardContent>
      </Card>
    )
  }

  const fields = [
    { label: "Crop", orig: original.cropName, new: newExtraction?.cropName || "-" },
    { label: "Scientific", orig: original.scientificName || "-", new: newExtraction?.scientificName || "-" },
    { label: "Category", orig: original.category, new: newExtraction?.category || "-" },
    { label: "Soil pH", orig: original.soilRequirements.ph_range, new: newExtraction?.soilRequirements.ph_range || "-" },
    { label: "Drainage", orig: original.soilRequirements.drainage, new: newExtraction?.soilRequirements.drainage || "-" },
    { label: "Temperature", orig: original.climateRequirements.temperature, new: newExtraction?.climateRequirements.temperature || "-" },
    { label: "Rainfall", orig: original.climateRequirements.rainfall, new: newExtraction?.climateRequirements.rainfall || "-" },
    { label: "Humidity", orig: original.climateRequirements.humidity, new: newExtraction?.climateRequirements.humidity || "-" },
    { label: "Season", orig: original.plantingInfo.season, new: newExtraction?.plantingInfo.season || "-" },
    { label: "Duration", orig: original.plantingInfo.duration, new: newExtraction?.plantingInfo.duration || "-" },
    { label: "Avg Yield", orig: `${original.yieldInfo.average} ${original.yieldInfo.unit}`, new: newExtraction ? `${newExtraction.yieldInfo.average} ${newExtraction.yieldInfo.unit}` : "-" },
  ]

  const matchCount = fields.filter((f) => f.orig === f.new).length
  const consistency = newExtraction
    ? Math.round((matchCount / fields.length) * 100)
    : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Comparison</CardTitle>
          {consistency !== null && (
            <span className={`text-sm font-medium ${consistency >= 80 ? "text-green-600" : "text-yellow-600"}`}>
              Consistency: {consistency}%
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-[120px_1fr_1fr] gap-2 border-b pb-2 mb-2 text-sm font-medium">
          <span>Field</span>
          <span>Original</span>
          <span>New Extraction</span>
        </div>
        {fields.map((f) => (
          <FieldRow key={f.label} label={f.label} original={f.orig} newValue={f.new} />
        ))}
      </CardContent>
    </Card>
  )
}
