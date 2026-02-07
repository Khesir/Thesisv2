/**
 * API Token Entity - MongoDB Model
 *
 * Mongoose schema and model for the APIToken collection.
 * Stores LLM provider credentials with usage tracking.
 * Uses types from api-token/types.ts
 */

import mongoose, { Schema } from "mongoose"
import type { IAPIToken, TokenProvider } from "./types"

const APITokenSchema = new Schema<IAPIToken>(
  {
    provider: {
      type: String,
      enum: ["anthropic", "google", "openai"],
      required: true,
      description: "LLM provider (anthropic, google, openai)",
    },
    token: {
      type: String,
      required: true,
      description: "API key/token (encrypted at rest)",
    },
    alias: {
      type: String,
      required: true,
      description: "User-friendly name for this token",
    },
    usageCount: {
      type: Number,
      default: 0,
      description: "Number of API requests made with this token",
    },
    usageLimit: {
      type: Number,
      default: null,
      description: "Maximum requests allowed (null = unlimited)",
    },
    isActive: {
      type: Boolean,
      default: true,
      description: "Whether this token is available for use",
    },
    lastUsedAt: {
      type: Date,
      default: null,
      description: "Timestamp of last usage",
    },
  },
  {
    timestamps: true,
    collection: "apitokens",
  }
)

// ============= INDEXES =============
// Migration: 001_initial creates these indexes
APITokenSchema.index({ provider: 1 })
APITokenSchema.index({ isActive: 1 })

// ============= METHODS =============

/**
 * Instance method: Check if token is exhausted (reached limit)
 */
APITokenSchema.methods.isExhausted = function () {
  if (this.usageLimit === null) return false
  return this.usageCount >= this.usageLimit
}

/**
 * Instance method: Record a usage
 */
APITokenSchema.methods.recordUsage = function (count: number = 1) {
  this.usageCount += count
  this.lastUsedAt = new Date()
  return this.save()
}

/**
 * Instance method: Get usage percentage
 */
APITokenSchema.methods.getUsagePercentage = function (): number | null {
  if (this.usageLimit === null) return null
  return Math.round((this.usageCount / this.usageLimit) * 100)
}

/**
 * Static method: Get available tokens for provider
 */
APITokenSchema.statics.getAvailable = function (provider: TokenProvider) {
  return this.find({
    provider,
    isActive: true,
    $or: [
      { usageLimit: null }, // Unlimited
      { $expr: { $lt: ["$usageCount", "$usageLimit"] } }, // Not exhausted
    ],
  })
}

/**
 * Static method: Get tokens by provider
 */
APITokenSchema.statics.getByProvider = function (provider: TokenProvider) {
  return this.find({ provider })
}

/**
 * Static method: Get active tokens
 */
APITokenSchema.statics.getActive = function () {
  return this.find({ isActive: true })
}

// ============= EXPORT =============

export const APITokenModel =
  mongoose.models.APIToken ||
  mongoose.model<IAPIToken>("APIToken", APITokenSchema)
