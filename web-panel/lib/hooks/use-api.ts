"use client"

import useSWR, { mutate } from "swr"
import type { Chunk } from "@/lib/types/chunk"
import type { ExtractedData } from "@/lib/types/extracted-data"
import type { APIToken } from "@/lib/types/api-token"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

// --- Chunks ---

interface ChunksResponse {
  success: boolean
  chunks: Chunk[]
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
  return useSWR<ChunksResponse>(`/api/chunks${qs ? `?${qs}` : ""}`, fetcher)
}

export function useSources() {
  return useSWR<{ success: boolean; sources: string[] }>("/api/chunks/sources", fetcher)
}

export function mutateChunks() {
  mutate((key: string) => typeof key === "string" && key.startsWith("/api/chunks"), undefined, { revalidate: true })
}

// --- Dashboard ---

interface DashboardStatsResponse {
  success: boolean
  stats: {
    totalChunks: number
    processedChunks: number
    validationChunks: number
    notProcessedChunks: number
    totalExtracted: number
  }
  sources: { source: string; total: number; processed: number }[]
}

interface CropsResponse {
  success: boolean
  crops: { name: string; count: number; category: string }[]
}

export function useDashboardStats() {
  return useSWR<DashboardStatsResponse>("/api/dashboard/stats", fetcher)
}

export function useCrops() {
  return useSWR<CropsResponse>("/api/dashboard/crops", fetcher)
}

// --- Extracted Data ---

interface PopulatedExtractedData extends Omit<ExtractedData, "chunkId"> {
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
  return useSWR<ExtractedResponse>(`/api/extracted${qs ? `?${qs}` : ""}`, fetcher)
}

export function mutateExtracted() {
  mutate((key: string) => typeof key === "string" && key.startsWith("/api/extracted"), undefined, { revalidate: true })
}

// --- Tokens ---

interface TokensResponse {
  success: boolean
  tokens: APIToken[]
}

export function useTokens() {
  return useSWR<TokensResponse>("/api/tokens", fetcher)
}

export async function createToken(data: {
  provider: string
  token: string
  alias: string
  usageLimit: number | null
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
  action: "accept" | "reject"
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
