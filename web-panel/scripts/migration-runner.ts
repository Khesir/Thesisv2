/* eslint-disable @next/next/no-assign-module-variable */
import mongoose from "mongoose"
import fs from "fs"
import path from "path"
import { pathToFileURL } from "url"
import type { Migration, MigrationDatabase, MigrationRecord } from "./migrations/types"
import type { Collection } from "mongodb"

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/thesis_panel"

/**
 * Get or create the migrations tracking collection
 */
async function getMigrationsCollection(
  db: MigrationDatabase
): Promise<Collection> {
  const collection = db.collection("migrations")
  await collection.createIndex({ name: 1 }, { unique: true })
  return collection as Collection
}

/**
 * Load all migration files from the migrations directory
 */
async function loadMigrations(): Promise<Migration[]> {
  const migrationsDir = path.join(__dirname, "migrations")

  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true })
    return []
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".ts") && f !== "types.ts")
    .sort()

  const migrations: Migration[] = []

  for (const file of files) {
    const modulePath = path.join(migrationsDir, file)
    // Convert Windows paths to file:// URLs for ESM import
    const moduleUrl = pathToFileURL(modulePath).href
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const module = await import(moduleUrl) as any

    // Skip if this is not a valid migration file (check for required exports)
    if (!module.name || !module.up) {
      console.warn(`⚠ Skipping ${file}: missing name or up function`)
      continue
    }

    migrations.push({
      name: module.name,
      description: module.description || "No description",
      up: module.up,
      down: module.down,
    })
  }

  return migrations
}

/**
 * Get list of already-executed migration names
 */
async function getExecutedMigrations(
  collection: Collection
): Promise<string[]> {
  const docs = await collection.find({}).toArray()
  return docs.map((d) => (d as unknown as MigrationRecord).name)
}

/**
 * Get the current batch number
 */
async function getCurrentBatch(collection: Collection): Promise<number> {
  const docs = await collection
    .find({})
    .sort({ batch: -1 })
    .limit(1)
    .toArray()
  return docs.length > 0 ? (docs[0] as unknown as MigrationRecord).batch : 0
}

/**
 * Run pending migrations (up direction)
 */
async function runUpMigrations(
  db: MigrationDatabase,
  migrations: Migration[],
  executedMigrations: string[],
  migrationsCollection: Collection
): Promise<void> {
  const pendingMigrations = migrations.filter(
    (m) => !executedMigrations.includes(m.name)
  )

  if (pendingMigrations.length === 0) {
    console.log("✓ No pending migrations")
    return
  }

  console.log(`Found ${pendingMigrations.length} pending migration(s):\n`)

  const currentBatch = await getCurrentBatch(migrationsCollection)
  const nextBatch = currentBatch + 1

  for (const migration of pendingMigrations) {
    console.log(`Running: ${migration.name}`)
    console.log(`  ${migration.description}`)

    try {
      await migration.up(db)
      await migrationsCollection.insertOne({
        name: migration.name,
        executedAt: new Date(),
        batch: nextBatch,
      } as MigrationRecord)
      console.log(`✓ ${migration.name} completed\n`)
    } catch (error) {
      console.error(`✗ ${migration.name} failed:`, error)
      throw error
    }
  }

  console.log(
    `✓ All migrations completed (${pendingMigrations.length} run in batch ${nextBatch})`
  )
}

/**
 * Rollback last batch of migrations (down direction)
 */
async function runDownMigrations(
  db: MigrationDatabase,
  migrations: Migration[],
  migrationsCollection: Collection
): Promise<void> {
  const lastBatch = await getCurrentBatch(migrationsCollection)

  if (lastBatch === 0) {
    console.log("✓ No migrations to rollback")
    return
  }

  const migrationsToRollback = (await migrationsCollection
    .find({ batch: lastBatch })
    .sort({ name: -1 })
    .toArray()) as unknown as MigrationRecord[]

  console.log(
    `Rolling back batch ${lastBatch} (${migrationsToRollback.length} migration(s)):\n`
  )

  for (const record of migrationsToRollback) {
    const migration = migrations.find((m) => m.name === record.name)
    if (!migration) {
      console.warn(`⚠ Migration ${record.name} not found, skipping rollback`)
      continue
    }

    console.log(`Rolling back: ${migration.name}`)

    try {
      if (migration.down) {
        await migration.down(db)
      } else {
        console.warn(`  (no down method defined)`)
      }
      await migrationsCollection.deleteOne({ name: record.name })
      console.log(`✓ ${migration.name} rolled back\n`)
    } catch (error) {
      console.error(`✗ ${migration.name} rollback failed:`, error)
      throw error
    }
  }

  console.log(`✓ Batch ${lastBatch} rolled back`)
}

/**
 * Main migration runner
 */
async function runMigrations(direction: "up" | "down" = "up"): Promise<void> {
  console.log(`Connecting to MongoDB...`)
  await mongoose.connect(MONGODB_URI)
  console.log(`Connected.\n`)

  const mongoDb = mongoose.connection.db
  if (!mongoDb) {
    throw new Error("Database connection not available")
  }

  const db = mongoDb as unknown as MigrationDatabase

  const migrationsCollection = await getMigrationsCollection(db)
  const allMigrations = await loadMigrations()
  const executedMigrations = await getExecutedMigrations(migrationsCollection)

  try {
    if (direction === "up") {
      await runUpMigrations(
        db,
        allMigrations,
        executedMigrations,
        migrationsCollection
      )
    } else {
      await runDownMigrations(db, allMigrations, migrationsCollection)
    }
  } finally {
    await mongoose.disconnect()
  }
}

// Parse command line args
const direction = process.argv[2] === "down" ? "down" : "up"

runMigrations(direction).catch((err) => {
  console.error("Migration error:", err)
  process.exit(1)
})
