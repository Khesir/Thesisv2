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
import { Eye, EyeOff, Loader2, HelpCircle } from "lucide-react"
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
  }) => void
}

export function AddTokenDialog({ open, onOpenChange, onSave }: AddTokenDialogProps) {
  const [provider, setProvider] = useState<TokenProvider>("google")
  const [alias, setAlias] = useState("")
  const [token, setToken] = useState("")
  const [usageLimit, setUsageLimit] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState(false)

  const handleSave = () => {
    onSave({
      provider,
      alias,
      token,
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
    })
    setProvider("google")
    setAlias("")
    setToken("")
    setUsageLimit("")
    onOpenChange(false)
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
        toast.success(`✓ Token is valid for ${provider}`)
      } else {
        toast.error(`✗ Token validation failed: ${result.error || "Invalid token"}`)
      }
    } catch (error) {
      toast.error("Failed to test token connection")
    } finally {
      setTesting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add API Token</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(v) => setProvider(v as TokenProvider)}>
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

          <div className="space-y-2">
            <Label>Usage Limit (optional)</Label>
            <Input
              type="number"
              placeholder="Leave empty for unlimited"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Set a maximum number of API calls to prevent accidental overages. Leave empty for unlimited use.
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
