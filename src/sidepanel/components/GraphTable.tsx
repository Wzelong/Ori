import { useEffect, useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ExternalLink } from 'lucide-react'
import { db } from '@/db/database'
import type { Graph } from '@/types/schema'

interface GraphStats {
  topics: number
  items: number
  edges: number
}

interface GraphWithStats extends Graph {
  stats: GraphStats
}

interface GraphTableProps {
  graphs: Graph[]
  onRowClick: (graph: Graph) => void
  selectedIds: Set<string>
  onSelectionChange: (ids: Set<string>) => void
}

export function GraphTable({ graphs, onRowClick, selectedIds, onSelectionChange }: GraphTableProps) {
  const [graphStats, setGraphStats] = useState<Map<string, GraphStats>>(new Map())

  useEffect(() => {
    const loadStats = async () => {
      const statsMap = new Map<string, GraphStats>()

      for (const graph of graphs) {
        const [topics, items, edges] = await Promise.all([
          db.topics.where('graphId').equals(graph.id).count(),
          db.items.where('graphId').equals(graph.id).count(),
          db.topic_edges.where('graphId').equals(graph.id).count()
        ])

        statsMap.set(graph.id, { topics, items, edges })
      }

      setGraphStats(statsMap)
    }

    loadStats()
  }, [graphs])

  const formatDate = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  const handleSelectAll = () => {
    if (selectedIds.size === graphs.length) {
      onSelectionChange(new Set())
    } else {
      onSelectionChange(new Set(graphs.map(g => g.id)))
    }
  }

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    onSelectionChange(newSelected)
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40%]">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={graphs.length > 0 && selectedIds.size === graphs.length}
                onCheckedChange={handleSelectAll}
              />
              <span>Name</span>
            </div>
          </TableHead>
          <TableHead className="w-[15%] text-center">Topics</TableHead>
          <TableHead className="w-[15%] text-center">Edges</TableHead>
          <TableHead className="w-[15%] text-center">Items</TableHead>
          <TableHead className="w-[15%] text-right">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {graphs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              No graphs found
            </TableCell>
          </TableRow>
        ) : (
          graphs.map((graph) => {
            const stats = graphStats.get(graph.id) || { topics: 0, items: 0, edges: 0 }
            return (
              <TableRow
                key={graph.id}
                className="cursor-pointer hover:bg-accent/50"
                onClick={() => onRowClick(graph)}
              >
                <TableCell className="w-[40%]">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedIds.has(graph.id)}
                      onCheckedChange={() => handleSelectOne(graph.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="truncate">{graph.name}</span>
                    {graph.isDefault && (
                      <span className="text-xs text-muted-foreground">(default)</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="w-[15%] text-center">
                  <span className="truncate">{stats.topics}</span>
                </TableCell>
                <TableCell className="w-[15%] text-center">
                  <span className="truncate">{stats.edges}</span>
                </TableCell>
                <TableCell className="w-[15%] text-center">
                  <span className="truncate">{stats.items}</span>
                </TableCell>
                <TableCell className="w-[15%] text-right text-xs text-muted-foreground">
                  <span className="truncate">{formatDate(graph.createdAt)}</span>
                </TableCell>
              </TableRow>
            )
          })
        )}
      </TableBody>
    </Table>
  )
}
