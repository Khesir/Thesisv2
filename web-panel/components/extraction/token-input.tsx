"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FlaskConical, Loader2, CheckCircle2, XCircle, AlertTriangle, Eye, EyeOff } from "lucide-react"
import { useTokens } from "@/lib/hooks/use-api"

export interface TokenStatus {
  tested: boolean
  valid: boolean
  quotaUsed: number
  quotaExhausted: boolean
  error?: string
}

interface TokenInputProps {
  token: string
  onTokenChange: (v: string) => void
  provider: string
  onProviderChange: (v: string) => void
  tokenStatus: TokenStatus
  onTest: () => void
  isTesting: boolean
  disabled?: boolean
}

export function TokenInput({
  token,
  onTokenChange,
  provider,
  onProviderChange,
  tokenStatus,
  onTest,
  isTesting,
  disabled = false,
}: TokenInputProps) {
  const [showToken, setShowToken] = useState(false)
  const [mode, setMode] = useState<"saved" | "manual">("manual")
  const [selectedTokenId, setSelectedTokenId] = useState("")
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [manualToken, setManualToken] = useState(token)

  const { data: tokensData } = useTokens()
  const savedTokens = tokensData?.tokens || []

  const handleModeChange = (newMode: string) => {
    setMode(newMode as "saved" | "manual")
    if (newMode === "manual") {
      setSelectedTokenId("")
      onTokenChange(manualToken)
    }
  }

  const handleSavedTokenSelect = async (id: string) => {
    setSelectedTokenId(id)
    setLoadingSaved(true)
    try {
      const res = await fetch(`/api/tokens/${id}/value`)
      const result = await res.json()
      if (result.success) {
        onTokenChange(result.token)
        onProviderChange(result.provider)
      }
    } catch {
      // ignore
    } finally {
      setLoadingSaved(false)
    }
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">API Token</Label>
          <Tabs value={mode} onValueChange={handleModeChange}>
            <TabsList className="h-7">
              <TabsTrigger value="saved" className="text-xs px-3 h-5">Saved</TabsTrigger>
              <TabsTrigger value="manual" className="text-xs px-3 h-5">Manual</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {mode === "saved" ? (
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={selectedTokenId}
              onValueChange={handleSavedTokenSelect}
              disabled={disabled || loadingSaved}
            >
              <SelectTrigger className="flex-1 min-w-[250px]">
                <SelectValue placeholder="Select a saved token..." />
              </SelectTrigger>
              <SelectContent>
                {savedTokens.length === 0 ? (
                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                    No saved tokens. Add one in Settings.
                  </div>
                ) : (
                  savedTokens.map((t) => (
                    <SelectItem key={t._id} value={t._id}>
                      <span className="font-medium">{t.alias}</span>
                      <span className="ml-2 text-muted-foreground text-xs capitalize">({t.provider})</span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>

            {loadingSaved && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

            {tokenStatus.tested && tokenStatus.valid && (
              <Badge
                variant={tokenStatus.quotaExhausted ? "destructive" : "outline"}
                className={tokenStatus.quotaExhausted ? "" : "border-green-300 text-green-700 bg-green-50"}
              >
                {tokenStatus.quotaExhausted ? "Quota exhausted" : `${tokenStatus.quotaUsed} used`}
              </Badge>
            )}

            <Button
              variant="outline"
              onClick={onTest}
              disabled={!token.trim() || isTesting || disabled || loadingSaved}
            >
              {isTesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="mr-2 h-4 w-4" />
              )}
              {isTesting ? "Testing..." : "Test"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Select value={provider} onValueChange={onProviderChange} disabled={disabled}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="anthropic">Claude</SelectItem>
                <SelectItem value="google">Gemini</SelectItem>
                <SelectItem value="ollama">Ollama</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1 min-w-[250px]">
              <Input
                type={showToken ? "text" : "password"}
                placeholder="Paste your API key..."
                value={manualToken}
                onChange={(e) => { setManualToken(e.target.value); onTokenChange(e.target.value) }}
                className="font-mono text-sm pr-9"
                disabled={disabled}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-full px-3 text-muted-foreground hover:text-foreground"
                onClick={() => setShowToken((v) => !v)}
                tabIndex={-1}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>

            {tokenStatus.tested && tokenStatus.valid && (
              <Badge
                variant={tokenStatus.quotaExhausted ? "destructive" : "outline"}
                className={tokenStatus.quotaExhausted ? "" : "border-green-300 text-green-700 bg-green-50"}
              >
                {tokenStatus.quotaExhausted ? "Quota exhausted" : `${tokenStatus.quotaUsed} used`}
              </Badge>
            )}

            <Button
              variant="outline"
              onClick={onTest}
              disabled={!token.trim() || isTesting || disabled}
            >
              {isTesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="mr-2 h-4 w-4" />
              )}
              {isTesting ? "Testing..." : "Test"}
            </Button>
          </div>
        )}

        {tokenStatus.tested && (
          <div className="flex items-center gap-2 text-sm">
            {tokenStatus.valid ? (
              tokenStatus.quotaExhausted ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-amber-600">
                    Quota exhausted (429). Swap to a different key or wait for the rate limit to reset, then re-test.
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-green-700">Token is valid and ready to use.</span>
                </>
              )
            ) : (
              <>
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-destructive">
                  {tokenStatus.error || "Token is invalid."}
                </span>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
