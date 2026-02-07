"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Layers, CheckCircle, AlertTriangle, Clock } from "lucide-react"

interface StatsCardsProps {
  stats: {
    totalChunks: number
    processedChunks: number
    validationChunks: number
    notProcessedChunks: number
  }
}

export function StatsCards({ stats }: StatsCardsProps) {
  const items = [
    {
      title: "Total Chunks",
      value: stats.totalChunks,
      icon: Layers,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      title: "Processed",
      value: stats.processedChunks,
      icon: CheckCircle,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-950",
    },
    {
      title: "Needs Validation",
      value: stats.validationChunks,
      icon: AlertTriangle,
      color: "text-yellow-600",
      bg: "bg-yellow-50 dark:bg-yellow-950",
    },
    {
      title: "Not Processed",
      value: stats.notProcessedChunks,
      icon: Clock,
      color: "text-gray-600",
      bg: "bg-gray-50 dark:bg-gray-950",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <div className={`rounded-md p-2 ${stat.bg}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
