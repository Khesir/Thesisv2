"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { MoreHorizontal, Pencil, Trash2, FlaskConical, Loader2, Eye, EyeOff } from "lucide-react"
import { useState } from "react"
import { type APITokenResponse } from "@/lib/entities/api-token"
import { toast } from "sonner"

interface TokenListProps {
  tokens: APITokenResponse[]
  onEdit: (token: APITokenResponse) => void
  onDelete: (token: APITokenResponse) => void
}

const providerColors: Record<string, string> = {
  google: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  anthropic: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  openai: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
}

export function TokenList({ tokens, onEdit, onDelete }: TokenListProps) {
  const [filter, setFilter] = useState("all")
  const [testingId, setTestingId] = useState<string | null>(null)
  const [revealedTokens, setRevealedTokens] = useState<Record<string, string>>({})
  const [revealingId, setRevealingId] = useState<string | null>(null)
  const [shownIds, setShownIds] = useState<Set<string>>(new Set())

  const handleTestToken = async (token: APITokenResponse) => {
    setTestingId(token._id)
    try {
      const res = await fetch(`/api/tokens/${token._id}/test`, { method: "POST" })
      const result = await res.json()
      if (result.valid) {
        toast.success(`${token.alias}: Token is valid`)
      } else {
        toast.error(`${token.alias}: ${result.error || "Invalid token"}`)
      }
    } catch {
      toast.error(`Failed to test ${token.alias}`)
    } finally {
      setTestingId(null)
    }
  }

  const handleToggleReveal = async (token: APITokenResponse) => {
    const id = token._id

    // If already shown, just hide
    if (shownIds.has(id)) {
      setShownIds((prev) => { const s = new Set(prev); s.delete(id); return s })
      return
    }

    // If we already fetched, just show
    if (revealedTokens[id]) {
      setShownIds((prev) => new Set(prev).add(id))
      return
    }

    // Fetch full token
    setRevealingId(id)
    try {
      const res = await fetch(`/api/tokens/${id}/value`)
      const result = await res.json()
      if (result.success) {
        setRevealedTokens((prev) => ({ ...prev, [id]: result.token }))
        setShownIds((prev) => new Set(prev).add(id))
      } else {
        toast.error("Failed to reveal token")
      }
    } catch {
      toast.error("Failed to reveal token")
    } finally {
      setRevealingId(null)
    }
  }

  const filtered = filter === "all" ? tokens : tokens.filter((t) => t.provider === filter)

  return (
    <div className="space-y-4">
      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Providers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Providers</SelectItem>
          <SelectItem value="google">Google</SelectItem>
          <SelectItem value="anthropic">Anthropic</SelectItem>
          <SelectItem value="openai">OpenAI</SelectItem>
        </SelectContent>
      </Select>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Alias</TableHead>
              <TableHead>Token</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No tokens found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((token) => {
                const isShown = shownIds.has(token._id)
                const isRevealing = revealingId === token._id
                return (
                  <TableRow key={token._id}>
                    <TableCell>
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${providerColors[token.provider]}`}>
                        {token.provider}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{token.alias}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-muted-foreground">
                          {isShown && revealedTokens[token._id]
                            ? revealedTokens[token._id]
                            : token.maskedToken}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                          onClick={() => handleToggleReveal(token)}
                          disabled={isRevealing}
                        >
                          {isRevealing
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : isShown
                              ? <EyeOff className="h-3.5 w-3.5" />
                              : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleTestToken(token)}
                            disabled={testingId === token._id}
                          >
                            {testingId === token._id
                              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              : <FlaskConical className="mr-2 h-4 w-4" />}
                            {testingId === token._id ? "Testing..." : "Test"}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEdit(token)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => onDelete(token)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
