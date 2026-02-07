export interface ExtractedData {
  _id: string
  chunkId: string
  cropName: string
  scientificName: string | null
  category: string
  soilRequirements: {
    types: string[]
    ph_range: string
    drainage: string
  }
  climateRequirements: {
    temperature: string
    rainfall: string
    humidity: string
    conditions: string[]
  }
  nutrients: {
    nitrogen: { rate: string; timing: string; notes: string }
    phosphorus: { rate: string; timing: string; notes: string }
    potassium: { rate: string; timing: string; notes: string }
    other_nutrients: { name: string; rate: string; notes: string }[]
  }
  plantingInfo: {
    season: string
    method: string
    spacing: string
    duration: string
  }
  farmingPractices: string[]
  pestsDiseases: { name: string; type: string; treatment: string }[]
  yieldInfo: {
    average: string
    range: string
    unit: string
  }
  regionalData: { region: string; specific_info: string }[]
  recommendations: string[]
  rawResponse: Record<string, unknown>
  validatedAt: string | null
  createdAt: string
  updatedAt: string
}
