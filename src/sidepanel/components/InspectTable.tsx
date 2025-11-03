import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import type { Topic, Item } from '@/types/schema'

interface InspectTableProps {
  mode: 'topics' | 'items'
  topics: Topic[]
  items: Item[]
  onRowClick: (type: 'topic' | 'item', id: string) => void
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
}

export function InspectTable({ mode, topics, items, onRowClick, selectedIds, onSelectionChange }: InspectTableProps) {
  const formatDate = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)
    const weeks = Math.floor(days / 7)
    const months = Math.floor(days / 30)
    const years = Math.floor(days / 365)

    if (years > 0) return `${years}y ago`
    if (months > 0) return `${months}mo ago`
    if (weeks > 0) return `${weeks}w ago`
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'just now'
  }

  const currentData = mode === 'topics' ? topics : items
  const isAllSelected = currentData.length > 0 && selectedIds.size === currentData.length

  const handleSelectAll = () => {
    onSelectionChange(
      selectedIds.size === currentData.length
        ? new Set()
        : new Set(currentData.map((d) => d.id))
    )
  }

  const handleSelectOne = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    onSelectionChange(newSet)
  }

  if (mode === 'topics') {
    return (
      <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={handleSelectAll}
                    className="cursor-pointer"
                    aria-label="Select all"
                  />
                  <span>Label</span>
                </div>
              </TableHead>
              <TableHead className="w-[20%]">Uses</TableHead>
              <TableHead className="w-[40%]">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics.length > 0 ? (
              topics.map((topic) => (
                <TableRow
                  key={topic.id}
                  className="cursor-pointer"
                  onClick={() => onRowClick('topic', topic.id)}
                >
                  <TableCell className="truncate max-w-0">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedIds.has(topic.id)}
                        onCheckedChange={() => handleSelectOne(topic.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="cursor-pointer"
                        aria-label={`Select ${topic.label}`}
                      />
                      <span>{topic.label}</span>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{topic.uses}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(topic.createdAt)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                  No topics found
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
    )
  }

  return (
    <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[85%]">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={isAllSelected}
                  onCheckedChange={handleSelectAll}
                  className="cursor-pointer"
                  aria-label="Select all"
                />
                <span>Title</span>
              </div>
            </TableHead>
            <TableHead className="w-[10%]">Created</TableHead>
            <TableHead className="w-[5%]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length > 0 ? (
            items.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onClick={() => onRowClick('item', item.id)}
              >
                <TableCell className="truncate max-w-0">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => handleSelectOne(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="cursor-pointer"
                      aria-label={`Select ${item.title}`}
                    />
                    <span>{item.title}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(item.createdAt)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      window.open(item.link, '_blank')
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                No items found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
  )
}
