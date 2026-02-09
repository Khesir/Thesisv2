"use client"

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
import { FlaskConical, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react"

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
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <Label className="text-sm font-medium">API Token</Label>
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

          <Input
            type="password"
            placeholder="Paste your API key..."
            value={token}
            onChange={(e) => onTokenChange(e.target.value)}
            className="flex-1 min-w-[250px] font-mono text-sm"
            disabled={disabled}
          />

          {tokenStatus.tested && tokenStatus.valid && (
            <Badge
              variant={tokenStatus.quotaExhausted ? "destructive" : "outline"}
              className={
                tokenStatus.quotaExhausted
                  ? ""
                  : "border-green-300 text-green-700 bg-green-50"
              }
            >
              {tokenStatus.quotaExhausted
                ? "Quota exhausted"
                : `${tokenStatus.quotaUsed} used`}
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
