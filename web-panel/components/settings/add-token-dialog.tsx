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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { type TokenProvider } from "@/lib/entities/api-token"
import { toast } from "sonner"

interface AddTokenDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: { provider: TokenProvider; alias: string; token: string }) => void
}

export function AddTokenDialog({ open, onOpenChange, onSave }: AddTokenDialogProps) {
  const [provider, setProvider] = useState<TokenProvider>("google")
  const [alias, setAlias] = useState("")
  const [token, setToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"untested" | "valid" | "invalid">("untested")

  const resetForm = () => {
    setProvider("google")
    setAlias("")
    setToken("")
    setTestResult("untested")
  }

  const handleTest = async () => {
    if (!token) { toast.error("Please enter a token first"); return }
    setTesting(true)
    try {
      const res = await fetch("/api/tokens/test-temp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, token }),
      })
      const result = await res.json()
      if (result.valid) {
        toast.success(`Token is valid for ${provider}`)
        setTestResult("valid")
      } else {
        toast.error(`Token validation failed: ${result.error || "Invalid token"}`)
        setTestResult("invalid")
      }
    } catch {
      toast.error("Failed to test token connection")
      setTestResult("invalid")
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    if (testResult === "invalid") { toast.error("Cannot save an invalid token."); return }
    if (testResult === "untested") { toast.warning("Please test the connection first."); return }
    onSave({ provider, alias, token })
    resetForm()
    onOpenChange(false)
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
            <Select value={provider} onValueChange={(v) => { setProvider(v as TokenProvider); setTestResult("untested") }}>
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
              <Label>Alias</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>A memorable name for this token. e.g. Main Key, Backup, Team Account</TooltipContent>
              </Tooltip>
            </div>
            <Input
              placeholder="e.g. Main Key, Backup API"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>API Token</Label>
            <div className="relative">
              <Input
                type={showToken ? "text" : "password"}
                placeholder="Paste your API key..."
                value={token}
                onChange={(e) => { setToken(e.target.value); setTestResult("untested") }}
                className="pr-10 font-mono text-sm"
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
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={!token || testing}
          >
            {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {testResult === "valid" ? "✓ Tested" : testResult === "invalid" ? "Retry Test" : "Test Connection"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={!alias || !token || testResult !== "valid"}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
