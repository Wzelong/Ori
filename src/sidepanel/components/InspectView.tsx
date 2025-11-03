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
import { Search, ListFilter, ArrowUpDown, ArrowLeft, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { db } from '@/db/database'
import { InspectTable } from './InspectTable'
import { TopicDetail } from './TopicDetail'
import { ItemDetail } from './ItemDetail'
import { deleteMultipleTopics, deleteMultipleItems } from '@/db/operations'
import type { Topic, Item } from '@/types/schema'

type FilterMode = 'topics' | 'items'
type SortField = 'createdAt' | 'uses'

export function InspectView() {
  const [filterMode, setFilterMode] = useState<FilterMode>('topics')
  const [sortField, setSortField] = useState<SortField>('createdAt')
  const [searchQuery, setSearchQuery] = useState('')
  const [topics, setTopics] = useState<Topic[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [selectedItem, setSelectedItem] = useState<{ type: 'topic' | 'item'; id: string } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(16)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  useEffect(() => {
    const loadData = async () => {
      const [allTopics, allItems] = await Promise.all([
        db.topics.toArray(),
        db.items.toArray()
      ])
      setTopics(allTopics)
      setItems(allItems)
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

  const filteredAndSortedTopics = useMemo(() => {
    let filtered = topics

    if (searchQuery) {
      filtered = filtered.filter(topic =>
        topic.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered.sort((a, b) => {
      if (sortField === 'uses') {
        return b.uses - a.uses
      }
      return b.createdAt - a.createdAt
    })
  }, [topics, searchQuery, sortField])

  const filteredAndSortedItems = useMemo(() => {
    let filtered = items

    if (searchQuery) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.summary.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    return filtered.sort((a, b) => b.createdAt - a.createdAt)
  }, [items, searchQuery])

  const paginatedTopics = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize
    return filteredAndSortedTopics.slice(startIdx, startIdx + pageSize)
  }, [filteredAndSortedTopics, currentPage, pageSize])

  const paginatedItems = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize
    return filteredAndSortedItems.slice(startIdx, startIdx + pageSize)
  }, [filteredAndSortedItems, currentPage, pageSize])

  const totalPages = useMemo(() => {
    const total = filterMode === 'topics' ? filteredAndSortedTopics.length : filteredAndSortedItems.length
    return Math.max(1, Math.ceil(total / pageSize))
  }, [filterMode, filteredAndSortedTopics.length, filteredAndSortedItems.length, pageSize])

  const handleRowClick = (type: 'topic' | 'item', id: string) => {
    setSelectedItem({ type, id })
  }

  const handleBack = () => {
    setSelectedItem(null)
  }

  const handleFilterChange = (mode: FilterMode) => {
    setFilterMode(mode)
    setSortField('createdAt')
    setSearchQuery('')
    setCurrentPage(1)
    setSelectedIds(new Set())
  }

  const handleDelete = async () => {
    const idsToDelete = Array.from(selectedIds)
    if (filterMode === 'topics') {
      await deleteMultipleTopics(idsToDelete)
    } else {
      await deleteMultipleItems(idsToDelete)
    }
    setSelectedIds(new Set())
    setShowDeleteDialog(false)
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sortField])

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const totalCount = filterMode === 'topics' ? filteredAndSortedTopics.length : filteredAndSortedItems.length

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 p-3 border-b bg-card">
        {selectedItem ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="h-8 px-3 gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        ) : selectedIds.size > 0 ? (
          <>
            <span className="text-xs text-muted-foreground flex-1 pl-1">
              {selectedIds.size} of {totalCount} Selected
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 cursor-pointer transition-colors hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
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
                    <ListFilter className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem
                    onClick={() => handleFilterChange('topics')}
                    className={filterMode === 'topics' ? 'bg-accent' : ''}
                  >
                    Topics
                    <span className="ml-auto text-xs text-muted-foreground">
                      {topics.length}
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleFilterChange('items')}
                    className={filterMode === 'items' ? 'bg-accent' : ''}
                  >
                    Items
                    <span className="ml-auto text-xs text-muted-foreground">
                      {items.length}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

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
                  {filterMode === 'topics' && (
                    <DropdownMenuItem onClick={() => setSortField('uses')}>
                      Uses {sortField === 'uses' && '✓'}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {selectedItem ? (
          selectedItem.type === 'topic' ? (
            <TopicDetail topicId={selectedItem.id} />
          ) : (
            <ItemDetail itemId={selectedItem.id} />
          )
        ) : (
          <>
            <div className="flex-1 overflow-auto">
              <InspectTable
                mode={filterMode}
                topics={paginatedTopics}
                items={paginatedItems}
                onRowClick={handleRowClick}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
              />
            </div>
            <div className="flex items-center justify-between p-3 border-t text-xs text-muted-foreground">
              <span>
                Showing {Math.min((currentPage - 1) * pageSize + 1, filterMode === 'topics' ? filteredAndSortedTopics.length : filteredAndSortedItems.length)}-{Math.min(currentPage * pageSize, filterMode === 'topics' ? filteredAndSortedTopics.length : filteredAndSortedItems.length)} of {filterMode === 'topics' ? filteredAndSortedTopics.length : filteredAndSortedItems.length}
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
          </>
        )}
      </div>
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} {filterMode === 'topics' ? 'topic' : 'item'}{selectedIds.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected {filterMode === 'topics' ? 'topic' : 'item'}{selectedIds.size !== 1 ? 's' : ''} and all associated relationships. This action cannot be undone.
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
    </div>
  )
}
