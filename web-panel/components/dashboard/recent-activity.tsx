"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface RecentActivityProps {
  extractedData: { _id: string; cropName: string; scientificName: string | null; category: string; validatedAt: string | null; createdAt: string }[]
}

export function RecentActivity({ extractedData }: RecentActivityProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Extractions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {extractedData.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No extractions yet</p>
          ) : (
            extractedData.map((data) => (
              <div
                key={data._id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{data.cropName}</p>
                  <p className="text-sm text-muted-foreground">
                    {data.scientificName || data.category}
                  </p>
                </div>
                <div className="text-right">
                  <Badge variant={data.validatedAt ? "default" : "secondary"}>
                    {data.validatedAt ? "Validated" : "Pending"}
                  </Badge>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {new Date(data.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
