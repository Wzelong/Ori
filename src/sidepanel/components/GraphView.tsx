import { useState, useEffect, useMemo } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, RotateCcw, Trash2 } from 'lucide-react'
import { db, ORION_GRAPH_ID } from '@/db/database'
import { GraphTable } from './GraphTable'
import { deleteGraph, resetGraph } from '@/services/graphManager'
import type { Graph } from '@/types/schema'

type SortField = 'createdAt' | 'name' | 'topics' | 'items' | 'edges'

interface GraphViewProps {
  onGraphSwitch: (graphId: string) => void
}

export function GraphView({ onGraphSwitch }: GraphViewProps) {
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [searchQuery, setSearchQuery] = useState('')
  const [graphs, setGraphs] = useState<Graph[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(16)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [graphStats, setGraphStats] = useState<Map<string, { topics: number; items: number; edges: number }>>(new Map())

  useEffect(() => {
    const loadData = async () => {
      const allGraphs = await db.graphs.toArray()
      setGraphs(allGraphs)

      const statsMap = new Map<string, { topics: number; items: number; edges: number }>()
      for (const graph of allGraphs) {
        const [topics, items, edges] = await Promise.all([
          db.topics.where('graphId').equals(graph.id).count(),
          db.items.where('graphId').equals(graph.id).count(),
          db.topic_edges.where('graphId').equals(graph.id).count()
        ])
        statsMap.set(graph.id, { topics, items, edges })
      }
      setGraphStats(statsMap)
    }

    loadData()

    const interval = setInterval(loadData, 2000)

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.lastInsertionTime) {
        loadData()
      }
    }

    chrome.storage.onChanged.addListener(listener)
    return () => {
      clearInterval(interval)
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [])

  const filteredAndSortedGraphs = useMemo(() => {
    let filtered = graphs

    if (searchQuery) {
      filtered = filtered.filter(graph =>
        graph.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered.sort((a, b) => {
      if (sortField === 'name') {
        return a.name.localeCompare(b.name)
      }
      if (sortField === 'createdAt') {
        return b.createdAt - a.createdAt
      }
      if (sortField === 'topics' || sortField === 'items' || sortField === 'edges') {
        const statsA = graphStats.get(a.id) || { topics: 0, items: 0, edges: 0 }
        const statsB = graphStats.get(b.id) || { topics: 0, items: 0, edges: 0 }
        return statsB[sortField] - statsA[sortField]
      }
      return 0
    })
  }, [graphs, searchQuery, sortField, graphStats])

  const paginatedGraphs = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize
    return filteredAndSortedGraphs.slice(startIdx, startIdx + pageSize)
  }, [filteredAndSortedGraphs, currentPage, pageSize])

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredAndSortedGraphs.length / pageSize))
  }, [filteredAndSortedGraphs.length, pageSize])

  const handleRowClick = (graph: Graph) => {
    onGraphSwitch(graph.id)
  }

  const handleDelete = async () => {
    const idsToDelete = Array.from(selectedIds).filter(id => id !== ORION_GRAPH_ID)
    for (const id of idsToDelete) {
      await deleteGraph(id)
    }
    setSelectedIds(new Set())
    setShowDeleteDialog(false)
  }

  const handleReset = async () => {
    const idsToReset = Array.from(selectedIds)
    for (const id of idsToReset) {
      await resetGraph(id)
    }
    setSelectedIds(new Set())
    setShowResetDialog(false)
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sortField])

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const totalCount = filteredAndSortedGraphs.length
  const hasOrionSelected = selectedIds.has(ORION_GRAPH_ID)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b bg-card">
        {selectedIds.size > 0 ? (
          <>
            <span className="text-xs text-muted-foreground flex-1 pl-1">
              {selectedIds.size} of {totalCount} Selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 cursor-pointer transition-colors hover:bg-accent/10"
              onClick={() => setShowResetDialog(true)}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 cursor-pointer transition-colors hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
              disabled={hasOrionSelected}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <>
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-7 h-8 text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:border-ring"
              />
            </div>
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem onClick={() => setSortField('createdAt')}>
                    Created {sortField === 'createdAt' && '✓'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortField('name')}>
                    Name {sortField === 'name' && '✓'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortField('topics')}>
                    Topics {sortField === 'topics' && '✓'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortField('items')}>
                    Items {sortField === 'items' && '✓'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSortField('edges')}>
                    Edges {sortField === 'edges' && '✓'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <GraphTable
            graphs={paginatedGraphs}
            onRowClick={handleRowClick}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        </div>
        <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
          <span>
            Showing {Math.min((currentPage - 1) * pageSize + 1, filteredAndSortedGraphs.length)}-{Math.min(currentPage * pageSize, filteredAndSortedGraphs.length)} of {filteredAndSortedGraphs.length}
          </span>
          <div className="flex items-center gap-4">
            <span>Page {currentPage} of {totalPages}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} graph{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected graph{selectedIds.size !== 1 ? 's' : ''} and all associated data (topics, items, edges). This action cannot be undone.
              {hasOrionSelected && (
                <span className="block mt-2 text-destructive">Note: The Orion graph cannot be deleted.</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset {selectedIds.size} graph{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all data (topics, items, edges) from the selected graph{selectedIds.size !== 1 ? 's' : ''}, but keep the graph{selectedIds.size !== 1 ? 's' : ''} themselves. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-destructive hover:bg-destructive/90">
              Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
