"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart"
import { Pie, PieChart } from "recharts"

interface CropChartProps {
  crops: { name: string; count: number; category: string }[]
}

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

export function CropChart({ crops }: CropChartProps) {
  const chartData = crops.map((crop, i) => ({
    name: crop.name,
    count: crop.count,
    fill: COLORS[i % COLORS.length],
  }))

  const chartConfig: ChartConfig = Object.fromEntries(
    chartData.map((item, i) => [
      item.name,
      { label: item.name, color: COLORS[i % COLORS.length] },
    ])
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crop Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No data yet</p>
        ) : (
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
