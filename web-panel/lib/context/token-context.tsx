"use client"

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react"
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
  modelFetchDone: boolean
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
  const [modelFetchDone, setModelFetchDone] = useState(false)
  const [selectedModel, setSelectedModel] = useState("")

  const resetTokenState = () => {
    setTokenStatus(DEFAULT_STATUS)
    setAvailableModels([])
    setSelectedModel("")
    setModelFetchDone(false)
  }

  const handleTokenChange = (v: string) => {
    if (v === apiKey) return
    setApiKey(v)
    if (tokenStatus.tested) {
      resetTokenState()
    }
  }

  const handleProviderChange = (v: string) => {
    if (v === provider) return
    setProvider(v)
    if (tokenStatus.tested) {
      resetTokenState()
    }
  }

  const handleModelChange = (v: string) => {
    setSelectedModel(v)
  }

  // Automatically fetch models whenever the token becomes valid.
  // Using useEffect decouples model loading from the test flow, avoiding
  // any React batching race where isLoadingModels=true renders before
  // tokenStatus.tested=true (which would hide the spinner via showModelSelector).
  const fetchCancelRef = useRef(false)

  useEffect(() => {
    if (!tokenStatus.tested || !tokenStatus.valid || tokenStatus.quotaExhausted) {
      return
    }

    fetchCancelRef.current = false
    setModelFetchDone(false)
    setAvailableModels([])

    fetch("/api/models/list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey }),
    })
      .then((res) => res.json())
      .then((result) => {
        if (fetchCancelRef.current) return
        if (result.success && Array.isArray(result.models) && result.models.length > 0) {
          setAvailableModels(result.models)
        } else {
          toast.error(`Could not load models: ${result.error || "Unknown error"}`)
        }
      })
      .catch((err) => {
        if (fetchCancelRef.current) return
        toast.error(`Could not load models: ${err instanceof Error ? err.message : String(err)}`)
      })
      .finally(() => {
        if (!fetchCancelRef.current) {
          setModelFetchDone(true)
        }
      })

    return () => {
      fetchCancelRef.current = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenStatus.tested, tokenStatus.valid, tokenStatus.quotaExhausted])

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
      } else {
        toast.error(result.error || "Token is invalid")
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
      modelFetchDone,
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
