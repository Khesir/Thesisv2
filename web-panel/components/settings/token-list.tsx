"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
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
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { useState } from "react"
import { APIToken } from "@/lib/types/api-token"

interface TokenListProps {
  tokens: APIToken[]
  onEdit: (token: APIToken) => void
  onDelete: (token: APIToken) => void
}

const providerColors: Record<string, string> = {
  google: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  anthropic: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  openai: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
}

function maskToken(token: string) {
  if (token.length <= 8) return "****"
  return token.slice(0, 4) + "..." + token.slice(-4)
}

export function TokenList({ tokens, onEdit, onDelete }: TokenListProps) {
  const [filter, setFilter] = useState("all")

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
              <TableHead>Usage</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-16">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No tokens found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((token) => {
                const exhausted = token.usageLimit !== null && token.usageCount >= token.usageLimit
                const status = !token.isActive
                  ? "inactive"
                  : exhausted
                    ? "exhausted"
                    : "active"

                return (
                  <TableRow key={token._id}>
                    <TableCell>
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${providerColors[token.provider]}`}>
                        {token.provider}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{token.alias}</TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {maskToken(token.token)}
                    </TableCell>
                    <TableCell>
                      {token.usageCount} / {token.usageLimit ?? "\u221E"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          status === "active"
                            ? "default"
                            : status === "exhausted"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEdit(token)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => onDelete(token)}
                          >
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
