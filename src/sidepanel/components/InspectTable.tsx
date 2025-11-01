import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Topic, Item } from '@/types/schema'

interface InspectTableProps {
  mode: 'topics' | 'items'
  topics: Topic[]
  items: Item[]
  onRowClick: (type: 'topic' | 'item', id: string) => void
}

export function InspectTable({ mode, topics, items, onRowClick }: InspectTableProps) {
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

  if (mode === 'topics') {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Label</TableHead>
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
                <TableCell className="truncate max-w-0">{topic.label}</TableCell>
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
          <TableHead className="w-[85%]">Title</TableHead>
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
              <TableCell className="truncate max-w-0">{item.title}</TableCell>
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
