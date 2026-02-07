"use client"

import { useState, useEffect } from "react"
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
import { Switch } from "@/components/ui/switch"
import { APIToken } from "@/lib/types/api-token"

interface EditTokenDialogProps {
  token: APIToken | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, data: { alias: string; usageLimit: number | null; isActive: boolean }) => void
}

export function EditTokenDialog({ token, open, onOpenChange, onSave }: EditTokenDialogProps) {
  const [alias, setAlias] = useState("")
  const [usageLimit, setUsageLimit] = useState("")
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (token) {
      setAlias(token.alias)
      setUsageLimit(token.usageLimit?.toString() || "")
      setIsActive(token.isActive)
    }
  }, [token])

  const handleSave = () => {
    if (!token) return
    onSave(token._id, {
      alias,
      usageLimit: usageLimit ? parseInt(usageLimit) : null,
      isActive,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Token</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Alias</Label>
            <Input value={alias} onChange={(e) => setAlias(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Usage Limit</Label>
            <Input
              type="number"
              placeholder="Leave empty for unlimited"
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Active</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={!alias}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
