"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { TokenList } from "@/components/settings/token-list"
import { AddTokenDialog } from "@/components/settings/add-token-dialog"
import { EditTokenDialog } from "@/components/settings/edit-token-dialog"
import { DeleteTokenDialog } from "@/components/settings/delete-token-dialog"
import { useTokens, createToken, updateToken, deleteToken } from "@/lib/hooks/use-api"
import { APIToken } from "@/lib/types/api-token"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

export default function SettingsPage() {
  const { data, isLoading } = useTokens()
  const tokens = data?.tokens || []
  const [addOpen, setAddOpen] = useState(false)
  const [editToken, setEditToken] = useState<APIToken | null>(null)
  const [deleteTokenState, setDeleteToken] = useState<APIToken | null>(null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Settings</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Token
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <TokenList
          tokens={tokens}
          onEdit={setEditToken}
          onDelete={setDeleteToken}
        />
      )}

      <AddTokenDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSave={async (data) => {
          const result = await createToken(data)
          if (result.success) {
            toast.success(`Token "${data.alias}" added`)
          } else {
            toast.error(result.error || "Failed to add token")
          }
        }}
      />

      <EditTokenDialog
        token={editToken}
        open={!!editToken}
        onOpenChange={(open) => !open && setEditToken(null)}
        onSave={async (id, data) => {
          const result = await updateToken(id, data)
          if (result.success) {
            toast.success("Token updated")
            setEditToken(null)
          } else {
            toast.error(result.error || "Failed to update token")
          }
        }}
      />

      <DeleteTokenDialog
        token={deleteTokenState}
        open={!!deleteTokenState}
        onOpenChange={(open) => !open && setDeleteToken(null)}
        onConfirm={async (id) => {
          const result = await deleteToken(id)
          if (result.success) {
            toast.success("Token deleted")
            setDeleteToken(null)
          } else {
            toast.error(result.error || "Failed to delete token")
          }
        }}
      />
    </div>
  )
}
