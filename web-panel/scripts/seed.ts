import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/thesis_panel"

// Inline schemas to avoid path alias issues in scripts
const ChunkSchema = new mongoose.Schema(
  {
    source: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    content: { type: String, required: true },
    tokenCount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["not-processed", "processing", "requires-validation", "processed"],
      default: "not-processed",
    },
    processedDataId: { type: mongoose.Schema.Types.ObjectId, ref: "ExtractedData", default: null },
  },
  { timestamps: true }
)

const NutrientSchema = new mongoose.Schema(
  { rate: String, timing: String, notes: String },
  { _id: false }
)

const ExtractedDataSchema = new mongoose.Schema(
  {
    chunkId: { type: mongoose.Schema.Types.ObjectId, ref: "Chunk", required: true },
    cropName: { type: String, required: true },
    scientificName: { type: String, default: null },
    category: { type: String, required: true },
    soilRequirements: {
      types: [String],
      ph_range: String,
      drainage: String,
    },
    climateRequirements: {
      temperature: String,
      rainfall: String,
      humidity: String,
      conditions: [String],
    },
    nutrients: {
      nitrogen: NutrientSchema,
      phosphorus: NutrientSchema,
      potassium: NutrientSchema,
      other_nutrients: [{ name: String, rate: String, notes: String }],
    },
    plantingInfo: {
      season: String,
      method: String,
      spacing: String,
      duration: String,
    },
    farmingPractices: [String],
    pestsDiseases: [{ name: String, type: String, treatment: String }],
    yieldInfo: {
      average: String,
      range: String,
      unit: String,
    },
    regionalData: [{ region: String, specific_info: String }],
    recommendations: [String],
    rawResponse: { type: mongoose.Schema.Types.Mixed, default: {} },
    validatedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

const APITokenSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["anthropic", "google", "openai"], required: true },
    token: { type: String, required: true },
    alias: { type: String, required: true },
    usageCount: { type: Number, default: 0 },
    usageLimit: { type: Number, default: null },
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

async function seed() {
  console.log("Connecting to MongoDB...")
  await mongoose.connect(MONGODB_URI)
  console.log("Connected.")

  const Chunk = mongoose.models.Chunk || mongoose.model("Chunk", ChunkSchema)
  const ExtractedData = mongoose.models.ExtractedData || mongoose.model("ExtractedData", ExtractedDataSchema)
  const APIToken = mongoose.models.APIToken || mongoose.model("APIToken", APITokenSchema)

  // Clear existing data
  await Chunk.deleteMany({})
  await ExtractedData.deleteMany({})
  await APIToken.deleteMany({})
  console.log("Cleared existing data.")

  // Seed chunks
  const chunks = await Chunk.insertMany([
    {
      source: "FAO-Crop Soil Requirements.pdf",
      chunkIndex: 0,
      content: "Wheat (Triticum aestivum) is one of the most important cereal crops globally. It thrives in well-drained, fertile loamy soils with a pH range of 6.0 to 7.0. Wheat requires a temperate climate with temperatures between 15-25°C during the growing season. Annual rainfall of 400-750mm is ideal, though supplemental irrigation can compensate for lower rainfall. The crop is sensitive to waterlogging and performs best in regions with moderate humidity levels of 50-70%.",
      tokenCount: 1024,
      status: "processed",
    },
    {
      source: "FAO-Crop Soil Requirements.pdf",
      chunkIndex: 1,
      content: "Rice (Oryza sativa) is a staple food for more than half of the world's population. It thrives in clay or clay loam soils that can retain water, with an optimal pH of 5.5 to 6.5. Rice requires a tropical or subtropical climate with temperatures of 20-35°C. It needs abundant water, with annual rainfall of 1000-2000mm or access to irrigation. High humidity of 60-80% is beneficial during the vegetative and reproductive stages.",
      tokenCount: 998,
      status: "requires-validation",
    },
    {
      source: "FAO-Crop Soil Requirements.pdf",
      chunkIndex: 2,
      content: "Maize (Zea mays) is a versatile cereal crop used for food, feed, and industrial purposes. It grows best in deep, well-drained loamy soils with a pH of 5.8 to 7.0. Maize requires warm temperatures of 18-32°C and is frost-sensitive. Annual rainfall of 500-800mm during the growing season is adequate. It is moderately tolerant of drought but sensitive to waterlogging.",
      tokenCount: 1100,
      status: "not-processed",
    },
    {
      source: "FAO-Crop Soil Requirements.pdf",
      chunkIndex: 3,
      content: "Soybean (Glycine max) is a major oilseed and protein crop. It prefers well-drained, fertile loamy soils with a pH of 6.0 to 6.8. Soybeans thrive in warm climates with temperatures between 20-30°C. The crop requires 450-700mm of rainfall during the growing season and is moderately tolerant of drought.",
      tokenCount: 890,
      status: "not-processed",
    },
    {
      source: "FAO-Crop Soil Requirements.pdf",
      chunkIndex: 4,
      content: "Potato (Solanum tuberosum) is one of the most widely grown tuber crops. It performs best in loose, well-drained sandy loam soils with pH 5.0-6.0. Potatoes require cool temperatures of 15-20°C for tuber development. Annual rainfall of 500-700mm is optimal with supplemental irrigation during dry periods.",
      tokenCount: 950,
      status: "not-processed",
    },
    {
      source: "Manual-Tropical Crops.pdf",
      chunkIndex: 0,
      content: "Cassava (Manihot esculenta) is a tropical root crop valued for its starchy tubers. It grows in a wide range of soils but prefers sandy loam to clay loam with pH 5.5-7.0. Cassava is highly drought-tolerant and thrives at temperatures of 25-35°C with annual rainfall of 1000-1500mm.",
      tokenCount: 1050,
      status: "processed",
    },
    {
      source: "Manual-Tropical Crops.pdf",
      chunkIndex: 1,
      content: "Banana (Musa spp.) is one of the most important tropical fruits. It requires deep, well-drained, humus-rich loamy soils with pH 5.5-7.0. Bananas need consistently warm temperatures of 26-30°C and high humidity. Annual rainfall should be 1500-2500mm, well-distributed throughout the year.",
      tokenCount: 980,
      status: "requires-validation",
    },
    {
      source: "Manual-Tropical Crops.pdf",
      chunkIndex: 2,
      content: "Sugarcane (Saccharum officinarum) is a major cash crop grown in tropical and subtropical regions. It thrives in deep, fertile, well-drained loamy soils with pH 6.0-7.5. Temperatures of 20-35°C are ideal, with annual rainfall of 1500-2500mm. The crop requires a long growing season of 12-18 months.",
      tokenCount: 1020,
      status: "not-processed",
    },
  ])
  console.log(`Seeded ${chunks.length} chunks.`)

  // Seed extracted data linked to chunks
  const wheatChunk = chunks[0]
  const riceChunk = chunks[1]
  const cassavaChunk = chunks[5]
  const bananaChunk = chunks[6]

  const extracted = await ExtractedData.insertMany([
    {
      chunkId: wheatChunk._id,
      cropName: "Wheat",
      scientificName: "Triticum aestivum",
      category: "cereal",
      soilRequirements: { types: ["loamy", "well-drained"], ph_range: "6.0-7.0", drainage: "well-drained" },
      climateRequirements: { temperature: "15-25°C", rainfall: "400-750mm annually", humidity: "50-70%", conditions: ["temperate", "moderate"] },
      nutrients: {
        nitrogen: { rate: "120-150 kg/ha", timing: "Split application", notes: "Apply at sowing and tillering" },
        phosphorus: { rate: "60-80 kg/ha", timing: "At sowing", notes: "Essential for root development" },
        potassium: { rate: "40-60 kg/ha", timing: "At sowing", notes: "Improves grain quality" },
        other_nutrients: [{ name: "Zinc", rate: "5 kg/ha", notes: "Foliar application recommended" }],
      },
      plantingInfo: { season: "October-November (Rabi)", method: "Broadcasting or drilling", spacing: "20-22.5 cm row spacing", duration: "120-150 days" },
      farmingPractices: ["Crop rotation with legumes", "Conservation tillage", "Integrated pest management"],
      pestsDiseases: [
        { name: "Rust", type: "fungal", treatment: "Fungicide application" },
        { name: "Aphids", type: "insect", treatment: "Neem-based insecticide" },
      ],
      yieldInfo: { average: "3.5", range: "2.5-5.0", unit: "tonnes/ha" },
      regionalData: [
        { region: "South Asia", specific_info: "Major Rabi crop in Indo-Gangetic plains" },
        { region: "Europe", specific_info: "Winter wheat dominant in Western Europe" },
      ],
      recommendations: ["Use certified seeds", "Maintain optimal soil moisture", "Apply micronutrients based on soil test"],
      rawResponse: {},
      validatedAt: new Date("2025-01-15T12:00:00Z"),
    },
    {
      chunkId: riceChunk._id,
      cropName: "Rice",
      scientificName: "Oryza sativa",
      category: "cereal",
      soilRequirements: { types: ["clay", "clay loam"], ph_range: "5.5-6.5", drainage: "poor drainage acceptable (paddy)" },
      climateRequirements: { temperature: "20-35°C", rainfall: "1000-2000mm annually", humidity: "60-80%", conditions: ["tropical", "subtropical"] },
      nutrients: {
        nitrogen: { rate: "100-120 kg/ha", timing: "Split 3 times", notes: "Basal, tillering, panicle initiation" },
        phosphorus: { rate: "40-60 kg/ha", timing: "Basal", notes: "" },
        potassium: { rate: "40-60 kg/ha", timing: "Basal and panicle", notes: "" },
        other_nutrients: [],
      },
      plantingInfo: { season: "June-July (Kharif)", method: "Transplanting", spacing: "20x15 cm", duration: "120-150 days" },
      farmingPractices: ["Puddling", "Alternate wetting and drying", "System of rice intensification"],
      pestsDiseases: [
        { name: "Blast", type: "fungal", treatment: "Tricyclazole" },
        { name: "Brown planthopper", type: "insect", treatment: "Imidacloprid" },
      ],
      yieldInfo: { average: "4.0", range: "3.0-6.0", unit: "tonnes/ha" },
      regionalData: [{ region: "Southeast Asia", specific_info: "Primary food crop" }],
      recommendations: ["Use disease-resistant varieties", "Proper water management"],
      rawResponse: {},
      validatedAt: null,
    },
    {
      chunkId: cassavaChunk._id,
      cropName: "Cassava",
      scientificName: "Manihot esculenta",
      category: "root/tuber",
      soilRequirements: { types: ["sandy loam", "clay loam"], ph_range: "5.5-7.0", drainage: "well-drained" },
      climateRequirements: { temperature: "25-35°C", rainfall: "1000-1500mm annually", humidity: "60-70%", conditions: ["tropical"] },
      nutrients: {
        nitrogen: { rate: "50-100 kg/ha", timing: "At planting", notes: "" },
        phosphorus: { rate: "30-50 kg/ha", timing: "At planting", notes: "" },
        potassium: { rate: "80-120 kg/ha", timing: "Split", notes: "Critical for tuber bulking" },
        other_nutrients: [],
      },
      plantingInfo: { season: "Start of rainy season", method: "Stem cuttings", spacing: "1m x 1m", duration: "8-18 months" },
      farmingPractices: ["Intercropping", "Mound planting"],
      pestsDiseases: [{ name: "Mosaic disease", type: "viral", treatment: "Use disease-free cuttings" }],
      yieldInfo: { average: "12", range: "8-25", unit: "tonnes/ha" },
      regionalData: [{ region: "Sub-Saharan Africa", specific_info: "Staple food crop" }],
      recommendations: ["Use improved varieties", "Harvest at maturity for max starch"],
      rawResponse: {},
      validatedAt: new Date("2025-01-16T16:00:00Z"),
    },
    {
      chunkId: bananaChunk._id,
      cropName: "Banana",
      scientificName: "Musa spp.",
      category: "fruit",
      soilRequirements: { types: ["loamy", "humus-rich"], ph_range: "5.5-7.0", drainage: "well-drained" },
      climateRequirements: { temperature: "26-30°C", rainfall: "1500-2500mm annually", humidity: "75-85%", conditions: ["tropical", "humid"] },
      nutrients: {
        nitrogen: { rate: "200-300 g/plant", timing: "Monthly", notes: "" },
        phosphorus: { rate: "50-100 g/plant", timing: "At planting", notes: "" },
        potassium: { rate: "300-500 g/plant", timing: "Monthly", notes: "Critical for fruit quality" },
        other_nutrients: [],
      },
      plantingInfo: { season: "Year-round in tropics", method: "Suckers or tissue culture", spacing: "2.5m x 2.5m", duration: "12-14 months to first harvest" },
      farmingPractices: ["Desuckering", "Mulching", "Propping"],
      pestsDiseases: [
        { name: "Panama disease", type: "fungal", treatment: "Resistant varieties" },
        { name: "Banana weevil", type: "insect", treatment: "Trapping and clean planting" },
      ],
      yieldInfo: { average: "30", range: "20-60", unit: "tonnes/ha" },
      regionalData: [],
      recommendations: ["Use tissue culture plants", "Maintain mulch cover"],
      rawResponse: {},
      validatedAt: null,
    },
  ])
  console.log(`Seeded ${extracted.length} extracted data records.`)

  // Link processedDataId back to chunks
  await Chunk.findByIdAndUpdate(wheatChunk._id, { processedDataId: extracted[0]._id })
  await Chunk.findByIdAndUpdate(riceChunk._id, { processedDataId: extracted[1]._id })
  await Chunk.findByIdAndUpdate(cassavaChunk._id, { processedDataId: extracted[2]._id })
  await Chunk.findByIdAndUpdate(bananaChunk._id, { processedDataId: extracted[3]._id })
  console.log("Linked chunks to extracted data.")

  // Seed sample tokens (with fake keys)
  const tokens = await APIToken.insertMany([
    {
      provider: "google",
      token: "AIzaSyB1234567890abcdefghijklmnopqrst4x2Q",
      alias: "Main Key",
      usageCount: 45,
      usageLimit: 100,
      isActive: true,
      lastUsedAt: new Date("2025-01-17T12:00:00Z"),
    },
    {
      provider: "google",
      token: "AIzaSyC0987654321zyxwvutsrqponmlkjihg8k1P",
      alias: "Backup",
      usageCount: 0,
      usageLimit: 100,
      isActive: true,
      lastUsedAt: null,
    },
    {
      provider: "anthropic",
      token: "sk-ant-1234567890abcdefghijklmnopqrstuvwxyz9xF3",
      alias: "Personal",
      usageCount: 12,
      usageLimit: null,
      isActive: true,
      lastUsedAt: new Date("2025-01-16T15:00:00Z"),
    },
  ])
  console.log(`Seeded ${tokens.length} API tokens.`)

  await mongoose.disconnect()
  console.log("Done! Database seeded successfully.")
}

seed().catch((err) => {
  console.error("Seed failed:", err)
  process.exit(1)
})
