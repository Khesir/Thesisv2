"use client"

import useSWR, { mutate } from "swr"
import type { ChunkResponse } from "@/lib/entities/chunk"
import type { ExtractedDataResponse } from "@/lib/entities/extracted-data"
import type { APITokenResponse } from "@/lib/entities/api-token"
import type { ValidationResultResponse } from "@/lib/entities/validation-result"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// SWR cache configuration to prevent unnecessary re-fetches
const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 60000, // 1 minute - prevent duplicate requests
  focusThrottleInterval: 300000, // 5 minutes - only revalidate on focus once per 5 mins
  errorRetryCount: 2,
}

// --- Chunks ---

interface ChunksResponse {
  success: boolean
  chunks: ChunkResponse[]
  total: number
  page: number
  totalPages: number
}

export function useChunks(params?: {
  status?: string
  source?: string
  search?: string
  sort?: string
  page?: number
  limit?: number
}) {
  const searchParams = new URLSearchParams()
  if (params?.status && params.status !== "all") searchParams.set("status", params.status)
  if (params?.source && params.source !== "all") searchParams.set("source", params.source)
  if (params?.search) searchParams.set("search", params.search)
  if (params?.sort) searchParams.set("sort", params.sort)
  if (params?.page) searchParams.set("page", String(params.page))
  if (params?.limit) searchParams.set("limit", String(params.limit))

  const qs = searchParams.toString()
  return useSWR<ChunksResponse>(`/api/chunks${qs ? `?${qs}` : ""}`, fetcher, swrConfig)
}

export function useSources() {
  return useSWR<{ success: boolean; sources: string[] }>("/api/chunks/sources", fetcher, swrConfig)
}

export function mutateChunks() {
  mutate((key: string) => typeof key === "string" && key.startsWith("/api/chunks"))
}

// --- Dashboard ---

interface DashboardStatsResponse {
  success: boolean
  stats: {
    totalChunks: number
    processedChunks: number
    validationChunks: number
    notProcessedChunks: number
    rejectedChunks: number
    totalExtracted: number
  }
  sources: { source: string; total: number; processed: number }[]
}

interface CropsResponse {
  success: boolean
  crops: { name: string; count: number; category: string }[]
}

export function useDashboardStats() {
  return useSWR<DashboardStatsResponse>("/api/dashboard/stats", fetcher, swrConfig)
}

export function useCrops() {
  return useSWR<CropsResponse>("/api/dashboard/crops", fetcher, swrConfig)
}

// --- Extracted Data ---

interface PopulatedExtractedData extends Omit<ExtractedDataResponse, "chunkId"> {
  chunkId: { _id: string; source: string; chunkIndex: number } | string
}

interface ExtractedResponse {
  success: boolean
  data: PopulatedExtractedData[]
  total: number
  page: number
  totalPages: number
}

export function useExtractedData(params?: {
  category?: string
  source?: string
  sort?: string
  page?: number
  limit?: number
}) {
  const searchParams = new URLSearchParams()
  if (params?.category && params.category !== "all") searchParams.set("category", params.category)
  if (params?.source && params.source !== "all") searchParams.set("source", params.source)
  if (params?.sort) searchParams.set("sort", params.sort)
  if (params?.page) searchParams.set("page", String(params.page))
  if (params?.limit) searchParams.set("limit", String(params.limit))

  const qs = searchParams.toString()
  return useSWR<ExtractedResponse>(`/api/extracted${qs ? `?${qs}` : ""}`, fetcher, swrConfig)
}

export function mutateExtracted() {
  mutate((key: string) => typeof key === "string" && key.startsWith("/api/extracted"))
}

// --- Tokens ---

interface TokensResponse {
  success: boolean
  tokens: APITokenResponse[]
}

export function useTokens(options?: { refreshInterval?: number }) {
  return useSWR<TokensResponse>("/api/tokens", fetcher, {
    ...swrConfig,
    ...(options?.refreshInterval ? { refreshInterval: options.refreshInterval } : {}),
  })
}

export function mutateTokens() {
  mutate("/api/tokens")
}

export async function createToken(data: {
  provider: string
  token: string
  alias: string
  usageLimit?: number | null
  quotaLimit?: number | null
  cooldownMinutes?: number
}) {
  const res = await fetch("/api/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  const result = await res.json()
  mutate("/api/tokens")
  return result
}

export async function updateToken(id: string, data: Record<string, unknown>) {
  const res = await fetch(`/api/tokens/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  const result = await res.json()
  mutate("/api/tokens")
  return result
}

export async function deleteToken(id: string) {
  const res = await fetch(`/api/tokens/${id}`, { method: "DELETE" })
  const result = await res.json()
  mutate("/api/tokens")
  return result
}

export async function testTokenById(id: string) {
  const res = await fetch(`/api/tokens/${id}/test`, { method: "POST" })
  return res.json()
}

// --- Upload ---

export async function uploadPDF(file: File, chunkSize: number) {
  const formData = new FormData()
  formData.append("file", file)
  formData.append("chunkSize", String(chunkSize))

  const res = await fetch("/api/chunks/upload", {
    method: "POST",
    body: formData,
  })
  const result = await res.json()
  mutateChunks()
  return result
}

// --- Validation Results ---

interface ValidationResultsResponse {
  success: boolean
  data: ValidationResultResponse[]
  total: number
  page: number
  totalPages: number
}

interface ValidationSummaryResponse {
  success: boolean
  summary: {
    totalValidated: number
    avgConsistency: number
    avgAccuracy: number
    perField: Record<string, { consistencyRate: number; accuracyRate: number }>
  }
}

export function useValidationResults(params?: { summary?: boolean; page?: number; limit?: number }) {
  const searchParams = new URLSearchParams()
  if (params?.summary) searchParams.set("summary", "true")
  if (params?.page) searchParams.set("page", String(params.page))
  if (params?.limit) searchParams.set("limit", String(params.limit))

  const qs = searchParams.toString()
  return useSWR<ValidationResultsResponse | ValidationSummaryResponse>(
    `/api/validation-results${qs ? `?${qs}` : ""}`,
    fetcher,
    swrConfig
  )
}

export function mutateValidationResults() {
  mutate((key: string) => typeof key === "string" && key.startsWith("/api/validation-results"))
}

// --- Extraction ---

export async function processChunk(data: {
  chunkId?: string
  content: string
  provider?: string
  apiKey?: string
  strategy?: string
}) {
  const res = await fetch("/api/extraction/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  return res.json()
}

export async function confirmExtraction(data: {
  chunkId: string
  data?: Record<string, unknown>
  action: "accept" | "reject" | "reject-permanent"
}) {
  const res = await fetch("/api/extraction/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  const result = await res.json()
  mutateChunks()
  mutateExtracted()
  return result
}
