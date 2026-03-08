"use client"

import React, { createContext, useContext, useState, ReactNode } from "react"
import { toast } from "sonner"
import type { TokenStatus } from "@/components/extraction/token-input"

interface ModelOption {
  id: string
  name: string
}

interface TokenContextType {
  apiKey: string
  provider: string
  tokenStatus: TokenStatus
  isTesting: boolean
  availableModels: ModelOption[]
  isLoadingModels: boolean
  selectedModel: string
  handleTokenChange: (v: string) => void
  handleProviderChange: (v: string) => void
  handleTestToken: () => Promise<void>
  handleModelChange: (v: string) => void
  markQuotaExhausted: () => void
  incrementQuotaUsed: () => void
}

const TokenContext = createContext<TokenContextType | undefined>(undefined)

const DEFAULT_STATUS: TokenStatus = {
  tested: false,
  valid: false,
  quotaUsed: 0,
  quotaExhausted: false,
}

export function TokenProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState("")
  const [provider, setProvider] = useState("google")
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>(DEFAULT_STATUS)
  const [isTesting, setIsTesting] = useState(false)
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([])
  const [isLoadingModels, setIsLoadingModels] = useState(false)
  const [selectedModel, setSelectedModel] = useState("")

  const resetTokenState = () => {
    setTokenStatus(DEFAULT_STATUS)
    setAvailableModels([])
    setSelectedModel("")
  }

  const handleTokenChange = (v: string) => {
    setApiKey(v)
    if (tokenStatus.tested) resetTokenState()
  }

  const handleProviderChange = (v: string) => {
    setProvider(v)
    if (tokenStatus.tested) resetTokenState()
  }

  const handleModelChange = (v: string) => {
    setSelectedModel(v)
  }

  const fetchModels = async (prov: string, key: string) => {
    setIsLoadingModels(true)
    try {
      const res = await fetch("/api/models/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: prov, apiKey: key }),
      })
      const result = await res.json()
      if (result.success && Array.isArray(result.models) && result.models.length > 0) {
        setAvailableModels(result.models)
        setSelectedModel(result.models[0].id)
      }
    } catch {
      // model listing is optional — don't block the user
    } finally {
      setIsLoadingModels(false)
    }
  }

  const handleTestToken = async () => {
    if (!apiKey.trim()) return
    setIsTesting(true)
    try {
      const res = await fetch("/api/tokens/test-temp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, token: apiKey }),
      })
      const result = await res.json()
      setTokenStatus({
        tested: true,
        valid: result.valid,
        quotaUsed: 0,
        quotaExhausted: false,
        error: result.error,
        model: result.model || undefined,
      })
      if (result.valid) {
        toast.success("Token valid — fetching available models...")
        // Fetch model list after successful validation
        fetchModels(provider, apiKey)
      } else {
        toast.error(result.error || "Token is invalid")
        setAvailableModels([])
        setSelectedModel("")
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setTokenStatus({ tested: true, valid: false, quotaUsed: 0, quotaExhausted: false, error: msg })
      toast.error(`Test failed: ${msg}`)
    } finally {
      setIsTesting(false)
    }
  }

  const markQuotaExhausted = () => {
    setTokenStatus((prev) => ({ ...prev, quotaExhausted: true }))
    toast.warning("Quota exhausted (429). Swap to a different key or wait, then re-test.")
  }

  const incrementQuotaUsed = () => {
    setTokenStatus((prev) => ({ ...prev, quotaUsed: prev.quotaUsed + 1 }))
  }

  return (
    <TokenContext.Provider value={{
      apiKey,
      provider,
      tokenStatus,
      isTesting,
      availableModels,
      isLoadingModels,
      selectedModel,
      handleTokenChange,
      handleProviderChange,
      handleTestToken,
      handleModelChange,
      markQuotaExhausted,
      incrementQuotaUsed,
    }}>
      {children}
    </TokenContext.Provider>
  )
}

export function useToken() {
  const context = useContext(TokenContext)
  if (!context) throw new Error("useToken must be used within a TokenProvider")
  return context
}
