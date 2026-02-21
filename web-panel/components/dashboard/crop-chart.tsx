"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
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
  const total = crops.reduce((sum, c) => sum + c.count, 0)

  const chartData = crops.map((crop, i) => ({
    name: crop.name || "null",
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
    <Card className="flex flex-col h-[420px]">
      <CardHeader>
        <CardTitle>Crop Distribution</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4 min-h-0">
        {chartData.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No data yet</p>
        ) : (
          <>
            <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[200px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={chartData}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                />
              </PieChart>
            </ChartContainer>
            <ScrollArea className="flex-1 min-h-0 overflow-x-hidden">
              <div className="space-y-2 w-full pr-3">
                {chartData.map((item) => {
                  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
                  return (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium min-w-0">{item.name}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  )
}
