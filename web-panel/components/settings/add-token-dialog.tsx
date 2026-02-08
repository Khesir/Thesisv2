"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Eye, EyeOff, Loader2, HelpCircle, Info } from "lucide-react"
import { TokenProvider } from "@/lib/types/api-token"
import { toast } from "sonner"

interface AddTokenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: {
    provider: TokenProvider
    alias: string
    token: string
    usageLimit: number | null
    quotaLimit: number | null
    cooldownMinutes: number
  }) => void
}

export function AddTokenDialog({ open, onOpenChange, onSave }: AddTokenDialogProps) {
  const [provider, setProvider] = useState<TokenProvider>("google")
  const [alias, setAlias] = useState("")
  const [token, setToken] = useState("")
  const [usageLimit, setUsageLimit] = useState("")
  const [quotaLimit, setQuotaLimit] = useState("")
  const [cooldownMinutes, setCooldownMinutes] = useState("60")
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState(false)
  const [detectedInfo, setDetectedInfo] = useState<string | null>(null)

  const handleSave = () => {
    onSave({
      provider,
      alias,
      token,
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      quotaLimit: quotaLimit ? parseInt(quotaLimit) : null,
      cooldownMinutes: cooldownMinutes ? parseInt(cooldownMinutes) : 60,
    })
    resetForm()
    onOpenChange(false)
  }

  const resetForm = () => {
    setProvider("google")
    setAlias("")
    setToken("")
    setUsageLimit("")
    setQuotaLimit("")
    setCooldownMinutes("60")
    setDetectedInfo(null)
  }

  const handleTest = async () => {
    if (!token) {
      toast.error("Please enter a token first")
      return
    }

    setTesting(true)
    try {
      const res = await fetch("/api/tokens/test-temp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          token,
        }),
      })

      const result = await res.json()

      if (result.valid) {
        toast.success(`Token is valid for ${provider}`)

        // Auto-fill quota settings from provider defaults
        if (result.suggestedQuotaLimit !== undefined) {
          setQuotaLimit(result.suggestedQuotaLimit !== null ? String(result.suggestedQuotaLimit) : "")
        }
        if (result.suggestedCooldownMinutes !== undefined) {
          setCooldownMinutes(String(result.suggestedCooldownMinutes))
        }
        if (result.providerDescription) {
          setDetectedInfo(result.providerDescription)
        }
      } else {
        toast.error(`Token validation failed: ${result.error || "Invalid token"}`)
        setDetectedInfo(null)
      }
    } catch (error) {
      toast.error("Failed to test token connection")
      setDetectedInfo(null)
    } finally {
      setTesting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add API Token</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v) => { setProvider(v as TokenProvider); setDetectedInfo(null) }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="google">Google (Gemini)</SelectItem>
                <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Alias (Friendly Name)</Label>
              <span
                title="A memorable name for this token. Examples: 'Main Key', 'Backup API', 'Team Account'"
                className="cursor-help"
              >
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </span>
            </div>
            <Input
              placeholder="e.g., Main Key, Backup API, Team Account"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use a name that helps you remember what this token is for (e.g., project name, environment, or purpose).
            </p>
          </div>

          <div className="space-y-2">
            <Label>API Token</Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                placeholder="Enter API token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0"
                onClick={() => setShowToken(!showToken)}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {detectedInfo && (
            <div className="flex items-start gap-2 rounded-md bg-blue-50 dark:bg-blue-950 p-3 text-sm text-blue-700 dark:text-blue-300">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{detectedInfo}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Daily Quota</Label>
              <Input
                type="number"
                placeholder="Unlimited"
                value={quotaLimit}
                onChange={(e) => setQuotaLimit(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Provider daily limit (resets at midnight)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Cooldown (min)</Label>
              <Input
                type="number"
                placeholder="60"
                value={cooldownMinutes}
                onChange={(e) => setCooldownMinutes(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Wait time after rate limit
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Usage Limit (optional)</Label>
            <Input
              type="number"
              placeholder="Leave empty for unlimited"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Hard cap on total requests. Different from daily quota.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleTest} disabled={!token || testing}>
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={!alias || !token}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
