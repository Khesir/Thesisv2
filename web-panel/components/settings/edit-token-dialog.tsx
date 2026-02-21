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
import { type APITokenResponse } from "@/lib/entities/api-token"

interface EditTokenDialogProps {
  token: APITokenResponse | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (id: string, data: { alias: string }) => void
}

export function EditTokenDialog({ token, open, onOpenChange, onSave }: EditTokenDialogProps) {
  const [alias, setAlias] = useState("")

  useEffect(() => {
    if (token) {
      setAlias(token.alias)
    }
  }, [token])

  const handleSave = () => {
    if (!token) return
    onSave(token._id, { alias })
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
            <Label>Provider</Label>
            <p className="text-sm text-muted-foreground capitalize">{token?.provider}</p>
          </div>

          <div className="space-y-2">
            <Label>Token</Label>
            <p className="text-sm font-mono text-muted-foreground">{token?.maskedToken}</p>
          </div>

          <div className="space-y-2">
            <Label>Alias</Label>
            <Input value={alias} onChange={(e) => setAlias(e.target.value)} />
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
