import mongoose, { Schema, Document } from "mongoose"
import type { TokenProvider } from "@/lib/types/api-token"

export interface IAPIToken extends Document {
  provider: TokenProvider
  token: string
  alias: string
  usageCount: number
  usageLimit: number | null
  isActive: boolean
  lastUsedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

const APITokenSchema = new Schema<IAPIToken>(
  {
    provider: {
      type: String,
      enum: ["anthropic", "google", "openai"],
      required: true,
    },
    token: { type: String, required: true },
    alias: { type: String, required: true },
    usageCount: { type: Number, default: 0 },
    usageLimit: { type: Number, default: null },
    isActive: { type: Boolean, default: true },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true }
)

APITokenSchema.index({ provider: 1 })
APITokenSchema.index({ isActive: 1 })

export const APITokenModel =
  mongoose.models.APIToken ||
  mongoose.model<IAPIToken>("APIToken", APITokenSchema)
