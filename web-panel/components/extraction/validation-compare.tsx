"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronDown, ChevronRight, Check, X } from "lucide-react"
import type { ExtractedDataResponse } from "@/lib/entities/extracted-data"

// ============= FIELD DEFINITIONS =============

interface FieldDef {
  key: string
  label: string
  path: string
  type: "structural" | "text"
}

interface FieldSection {
  title: string
  fields: FieldDef[]
}

const FIELD_SECTIONS: FieldSection[] = [
  {
    title: "Identity",
    fields: [
      { key: "cropName", label: "Crop Name", path: "cropName", type: "structural" },
      { key: "scientificName", label: "Scientific Name", path: "scientificName", type: "structural" },
      { key: "category", label: "Category", path: "category", type: "structural" },
    ],
  },
  {
    title: "Soil Requirements",
    fields: [
      { key: "soilRequirements.types", label: "Soil Types", path: "soilRequirements.types", type: "structural" },
      { key: "soilRequirements.ph_range", label: "pH Range", path: "soilRequirements.ph_range", type: "structural" },
      { key: "soilRequirements.drainage", label: "Drainage", path: "soilRequirements.drainage", type: "structural" },
    ],
  },
  {
    title: "Climate Requirements",
    fields: [
      { key: "climateRequirements.temperature", label: "Temperature", path: "climateRequirements.temperature", type: "structural" },
      { key: "climateRequirements.rainfall", label: "Rainfall", path: "climateRequirements.rainfall", type: "structural" },
      { key: "climateRequirements.humidity", label: "Humidity", path: "climateRequirements.humidity", type: "structural" },
      { key: "climateRequirements.conditions", label: "Conditions", path: "climateRequirements.conditions", type: "structural" },
    ],
  },
  {
    title: "Planting Info",
    fields: [
      { key: "plantingInfo.season", label: "Season", path: "plantingInfo.season", type: "structural" },
      { key: "plantingInfo.method", label: "Method", path: "plantingInfo.method", type: "structural" },
      { key: "plantingInfo.spacing", label: "Spacing", path: "plantingInfo.spacing", type: "structural" },
      { key: "plantingInfo.duration", label: "Duration", path: "plantingInfo.duration", type: "structural" },
    ],
  },
  {
    title: "Yield Info",
    fields: [
      { key: "yieldInfo.average", label: "Average Yield", path: "yieldInfo.average", type: "structural" },
      { key: "yieldInfo.range", label: "Yield Range", path: "yieldInfo.range", type: "structural" },
      { key: "yieldInfo.unit", label: "Unit", path: "yieldInfo.unit", type: "structural" },
    ],
  },
  {
    title: "Nutrients",
    fields: [
      { key: "nutrients.nitrogen.rate", label: "N - Rate", path: "nutrients.nitrogen.rate", type: "structural" },
      { key: "nutrients.nitrogen.timing", label: "N - Timing", path: "nutrients.nitrogen.timing", type: "structural" },
      { key: "nutrients.nitrogen.notes", label: "N - Notes", path: "nutrients.nitrogen.notes", type: "text" },
      { key: "nutrients.phosphorus.rate", label: "P - Rate", path: "nutrients.phosphorus.rate", type: "structural" },
      { key: "nutrients.phosphorus.timing", label: "P - Timing", path: "nutrients.phosphorus.timing", type: "structural" },
      { key: "nutrients.phosphorus.notes", label: "P - Notes", path: "nutrients.phosphorus.notes", type: "text" },
      { key: "nutrients.potassium.rate", label: "K - Rate", path: "nutrients.potassium.rate", type: "structural" },
      { key: "nutrients.potassium.timing", label: "K - Timing", path: "nutrients.potassium.timing", type: "structural" },
      { key: "nutrients.potassium.notes", label: "K - Notes", path: "nutrients.potassium.notes", type: "text" },
      { key: "nutrients.other_nutrients", label: "Other Nutrients", path: "nutrients.other_nutrients", type: "text" },
    ],
  },
  {
    title: "Advice & Practices",
    fields: [
      { key: "farmingPractices", label: "Farming Practices", path: "farmingPractices", type: "text" },
      { key: "pestsDiseases", label: "Pests & Diseases", path: "pestsDiseases", type: "text" },
      { key: "recommendations", label: "Recommendations", path: "recommendations", type: "text" },
      { key: "regionalData", label: "Regional Data", path: "regionalData", type: "text" },
    ],
  },
]

// All field keys flattened
const ALL_FIELD_KEYS = FIELD_SECTIONS.flatMap((s) => s.fields.map((f) => f.key))

// ============= HELPERS =============

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getByPath(obj: any, dotPath: string): unknown {
  return dotPath.split(".").reduce((acc, part) => acc?.[part], obj)
}

function isEmpty(val: unknown): boolean {
  if (val === null || val === undefined || val === "") return true
  if (Array.isArray(val) && val.length === 0) return true
  return false
}

function normalizeForCompare(val: unknown): string {
  if (isEmpty(val)) return ""
  if (Array.isArray(val)) {
    return val
      .map((v) => (typeof v === "object" ? JSON.stringify(v) : String(v).trim().toLowerCase()))
      .sort()
      .join("|")
  }
  if (typeof val === "object") return JSON.stringify(val)
  return String(val).trim().toLowerCase()
}

function checkConsistency(origVal: unknown, newVal: unknown): boolean {
  if (isEmpty(origVal) && isEmpty(newVal)) return true
  if (isEmpty(origVal) !== isEmpty(newVal)) return false
  return normalizeForCompare(origVal) === normalizeForCompare(newVal)
}

function formatValue(val: unknown): string {
  if (isEmpty(val)) return "\u2014"
  if (Array.isArray(val)) {
    if (val.length === 0) return "\u2014"
    if (typeof val[0] === "object") {
      return val.map((v) => {
        const entries = Object.entries(v as Record<string, unknown>)
          .filter(([, value]) => !isEmpty(value))
          .map(([k, value]) => `${k}: ${value}`)
        return entries.join(", ")
      }).join(" | ")
    }
    return val.join(", ")
  }
  if (typeof val === "object") return JSON.stringify(val)
  return String(val)
}

// ============= COMPONENT =============

export interface ValidationCompareProps {
  original: ExtractedDataResponse | null
  newExtraction: ExtractedDataResponse | null
  sourceText?: string
  onConsistencyChange?: (consistency: Record<string, boolean>, score: number) => void
  onAccuracyChange?: (accuracy: Record<string, boolean>, score: number) => void
}

export function ValidationCompare({
  original,
  newExtraction,
  sourceText,
  onConsistencyChange,
  onAccuracyChange,
}: ValidationCompareProps) {
  const [showSource, setShowSource] = useState(false)
  const [accuracy, setAccuracy] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    for (const key of ALL_FIELD_KEYS) init[key] = true
    return init
  })

  // Auto-calculate consistency per field
  const consistency = useMemo(() => {
    if (!original || !newExtraction) return null
    const result: Record<string, boolean> = {}
    for (const key of ALL_FIELD_KEYS) {
      const origVal = getByPath(original, key)
      const newVal = getByPath(newExtraction, key)
      result[key] = checkConsistency(origVal, newVal)
    }
    return result
  }, [original, newExtraction])

  const consistencyScore = useMemo(() => {
    if (!consistency) return 0
    const entries = Object.values(consistency)
    if (entries.length === 0) return 0
    return Math.round((entries.filter(Boolean).length / entries.length) * 100)
  }, [consistency])

  useEffect(() => {
    if (!consistency) return
    const entries = Object.values(consistency)
    if (entries.length === 0) return
    const score = Math.round((entries.filter(Boolean).length / entries.length) * 100)
    onConsistencyChange?.(consistency, score)
  }, [consistency, onConsistencyChange])

  const accuracyScore = useMemo(() => {
    const entries = Object.values(accuracy)
    if (entries.length === 0) return 0
    return Math.round((entries.filter(Boolean).length / entries.length) * 100)
  }, [accuracy])

  useEffect(() => {
    const entries = Object.values(accuracy)
    if (entries.length === 0) return
    const score = Math.round((entries.filter(Boolean).length / entries.length) * 100)
    onAccuracyChange?.(accuracy, score)
  }, [accuracy, onAccuracyChange])

  const accuracyCorrect = Object.values(accuracy).filter(Boolean).length
  const accuracyTotal = Object.values(accuracy).length

  const toggleAccuracy = (key: string) => {
    setAccuracy((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      return next
    })
  }

  if (!original) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Select a chunk from the queue to review its extraction
        </CardContent>
      </Card>
    )
  }

  const hasBoth = !!newExtraction

  return (
    <div className="space-y-4">
      <Card className="flex flex-col h-[600px]">
        <CardHeader className="pb-3 shrink-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Field Comparison</CardTitle>
            <div className="flex items-center gap-2">
              {consistency && (
                <Badge
                  variant={consistencyScore >= 80 ? "default" : "secondary"}
                  className={consistencyScore >= 80 ? "bg-green-600" : "bg-yellow-600"}
                >
                  Consistency: {consistencyScore}%
                </Badge>
              )}
              <Badge variant="outline">
                Accuracy: {accuracyCorrect}/{accuracyTotal} ({accuracyScore}%)
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col min-h-0 p-0">
          <div className="flex-1 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-transparent [&::-webkit-scrollbar-thumb]:bg-clip-padding">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background border-b">
                <tr>
                  <th className="w-10 px-3 py-2 text-left font-medium text-muted-foreground">Acc.</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Field</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                    {hasBoth ? "Original" : "Value"}
                  </th>
                  {hasBoth && (
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">New</th>
                  )}
                  {hasBoth && (
                    <th className="w-10 px-3 py-2 text-center font-medium text-muted-foreground">Con.</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {FIELD_SECTIONS.map((section) => (
                  <SectionRows
                    key={section.title}
                    section={section}
                    original={original}
                    newExtraction={newExtraction}
                    consistency={consistency}
                    accuracy={accuracy}
                    onToggleAccuracy={toggleAccuracy}
                    hasBoth={hasBoth}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Source text panel */}
      {sourceText && (
        <Card>
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setShowSource(!showSource)}>
            <div className="flex items-center gap-2">
              {showSource ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <CardTitle className="text-sm">Source Text</CardTitle>
            </div>
          </CardHeader>
          {showSource && (
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                <pre className="text-xs whitespace-pre-wrap font-mono text-muted-foreground">
                  {sourceText}
                </pre>
              </ScrollArea>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}

// ============= SECTION + ROW RENDERING =============

interface SectionRowsProps {
  section: FieldSection
  original: ExtractedDataResponse
  newExtraction: ExtractedDataResponse | null
  consistency: Record<string, boolean> | null
  accuracy: Record<string, boolean>
  onToggleAccuracy: (key: string) => void
  hasBoth: boolean
}

function SectionRows({
  section,
  original,
  newExtraction,
  consistency,
  accuracy,
  onToggleAccuracy,
  hasBoth,
}: SectionRowsProps) {
  return (
    <>
      <tr>
        <td
          colSpan={hasBoth ? 5 : 3}
          className="px-3 py-1.5 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
        >
          {section.title}
        </td>
      </tr>
      {section.fields.map((field) => {
        const origVal = getByPath(original, field.path)
        const newVal = newExtraction ? getByPath(newExtraction, field.path) : undefined
        const isConsistent = consistency?.[field.key]
        const isAccurate = accuracy[field.key] ?? true

        return (
          <tr
            key={field.key}
            className="border-b last:border-0 hover:bg-muted/30"
          >
            <td className="px-3 py-1.5">
              <Checkbox
                checked={isAccurate}
                onCheckedChange={() => onToggleAccuracy(field.key)}
                className="h-4 w-4"
              />
            </td>
            <td className="px-3 py-1.5 font-medium whitespace-nowrap">
              {field.label}
            </td>
            <td className="px-3 py-1.5 max-w-[300px]">
              <span className="text-xs break-words">
                {formatValue(origVal)}
              </span>
            </td>
            {hasBoth && (
              <td className="px-3 py-1.5 max-w-[300px]">
                <span className="text-xs break-words">
                  {formatValue(newVal)}
                </span>
              </td>
            )}
            {hasBoth && (
              <td className="px-3 py-1.5 text-center">
                {isConsistent ? (
                  <Check className="h-4 w-4 text-green-600 inline-block" />
                ) : (
                  <X className="h-4 w-4 text-red-500 inline-block" />
                )}
              </td>
            )}
          </tr>
        )
      })}
    </>
  )
}
