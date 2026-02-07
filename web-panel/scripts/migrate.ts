import mongoose from "mongoose"

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/thesis_panel"

async function migrate() {
  console.log("Connecting to MongoDB...")
  await mongoose.connect(MONGODB_URI)
  console.log("Connected.")

  const db = mongoose.connection.db
  if (!db) {
    throw new Error("Database connection not available")
  }

  // Create indexes for chunks collection
  const chunks = db.collection("chunks")
  await chunks.createIndex({ source: 1 })
  await chunks.createIndex({ status: 1 })
  await chunks.createIndex({ source: 1, status: 1 })
  await chunks.createIndex({ createdAt: -1 })
  console.log("Created indexes on chunks collection.")

  // Create indexes for extracteddata collection
  const extractedData = db.collection("extracteddatas")
  await extractedData.createIndex({ chunkId: 1 })
  await extractedData.createIndex({ cropName: 1 })
  await extractedData.createIndex({ category: 1 })
  await extractedData.createIndex({ createdAt: -1 })
  console.log("Created indexes on extracteddatas collection.")

  // Create indexes for apitokens collection
  const apiTokens = db.collection("apitokens")
  await apiTokens.createIndex({ provider: 1 })
  await apiTokens.createIndex({ isActive: 1 })
  console.log("Created indexes on apitokens collection.")

  await mongoose.disconnect()
  console.log("Done! Migration complete.")
}

migrate().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
