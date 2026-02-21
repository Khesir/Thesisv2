"use client"

import { StatsCards } from "@/components/dashboard/stats-cards"
import { CropChart } from "@/components/dashboard/crop-chart"
import { SourcesBreakdown } from "@/components/dashboard/sources-breakdown"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { ValidationMetrics } from "@/components/dashboard/validation-metrics"
import { useDashboardStats, useCrops, useExtractedData, useValidationResults } from "@/lib/hooks/use-api"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardPage() {
  const { data: statsData, isLoading: statsLoading } = useDashboardStats()
  const { data: cropsData, isLoading: cropsLoading } = useCrops()
  const { data: extractedData, isLoading: extractedLoading } = useExtractedData({ limit: 5, sort: "desc" })
  const { data: validationSummary, isLoading: validationLoading } = useValidationResults({ summary: true })

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : statsData?.success ? (
        <StatsCards stats={statsData.stats} />
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        {cropsLoading ? (
          <Skeleton className="h-64" />
        ) : cropsData?.success ? (
          <CropChart crops={cropsData.crops} />
        ) : null}

        {statsLoading ? (
          <Skeleton className="h-64" />
        ) : statsData?.success ? (
          <SourcesBreakdown sources={statsData.sources} />
        ) : null}
      </div>
  {validationLoading ? (
        <Skeleton className="h-48" />
      ) : validationSummary?.success && "summary" in validationSummary ? (
        <ValidationMetrics
          totalValidated={validationSummary.summary.totalValidated}
          rejectedChunks={statsData?.success ? statsData.stats.rejectedChunks ?? 0 : 0}
          avgAccuracy={validationSummary.summary.avgAccuracy}
          avgConsistency={validationSummary.summary.avgConsistency}
        />
      ) : null}
      {extractedLoading ? (
        <Skeleton className="h-48" />
      ) : extractedData?.success ? (
        <RecentActivity extractedData={extractedData.data} />
      ) : null}

    
    </div>
  )
}
