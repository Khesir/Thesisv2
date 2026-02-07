/**
 * Migration System Types
 *
 * Properly typed interfaces for the migration system.
 * Used by migration-runner.ts and all migration files.
 */

import type { Db, Collection } from "mongodb"

/**
 * Database interface for migrations
 * Represents the MongoDB connection object passed to migration functions
 */
export interface MigrationDatabase {
  collection: (name: string) => Collection
}

/**
 * Single migration file interface
 * All migration files must export these
 */
export interface Migration {
  name: string
  description: string
  up: (db: MigrationDatabase) => Promise<void>
  down?: (db: MigrationDatabase) => Promise<void>
}

/**
 * Migration record as stored in MongoDB
 * Tracks which migrations have been run
 */
export interface MigrationRecord {
  name: string
  executedAt: Date
  batch: number
}

/**
 * Result of running migrations
 */
export interface MigrationResult {
  success: boolean
  migrationsRun: string[]
  batch?: number
  error?: string
}
