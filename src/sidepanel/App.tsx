import { useState, useEffect } from 'react'
import { ExtractControl } from '@/popup/components/ExtractControl'
import { useExtraction } from '@/hooks/useExtraction'
import { ViewSelector } from './components/ViewSelector'
import { DeleteDatabaseButton } from './components/DeleteDatabaseButton'
import { ThemeToggle } from './components/ThemeToggle'
import { StatsBar } from './components/StatsBar'
import { ExploreInput } from './components/ExploreInput'
import { StarMap } from '@/components/StarMap'
import { db } from '@/db/database'
import type { TopicWithPosition, TopicEdge } from '@/types/schema'
import { getEmbedding } from '@/llm/embeddings'
import { findSimilarTopics, type TopicSearchResult } from '@/services/search'

const MAX_EDGES = 20

export default function App() {
  const extraction = useExtraction()
  const [view, setView] = useState<'explore' | 'inspect'>('explore')
  const [topics, setTopics] = useState<TopicWithPosition[]>([])
  const [highlightedTopics, setHighlightedTopics] = useState<TopicSearchResult[] | undefined>()
  const [edges, setEdges] = useState<TopicEdge[] | undefined>()
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    const loadTopics = async () => {
      const allTopics = await db.topics.toArray()
      const withPositions = allTopics.filter(
        (t): t is TopicWithPosition =>
          t.x !== undefined && t.y !== undefined && t.z !== undefined
      )
      setTopics(withPositions)
    }

    loadTopics()

    const interval = setInterval(loadTopics, 2000)
    return () => clearInterval(interval)
  }, [])

  const handleSearch = async (query: string) => {
    try {
      setIsSearching(true)
      console.log('[explore] Searching for:', query)

      const response = await chrome.runtime.sendMessage({
        type: 'GET_EMBEDDING',
        text: query
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to get embedding')
      }

      console.log('[explore] Embedding received, finding similar topics...')

      const results = await findSimilarTopics(response.embedding, 5, 0.3)

      console.log('[explore] Found', results.length, 'similar topics')
      setHighlightedTopics(results)

      if (results.length > 0) {
        const topicIds = new Set(results.map(r => r.topic.id))

        const allEdges = await db.topic_edges.toArray()
        const relevantEdges = allEdges
          .filter(edge => topicIds.has(edge.src) && topicIds.has(edge.dst))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, MAX_EDGES)

        console.log('[explore] Found', relevantEdges.length, 'edges between highlighted topics')
        setEdges(relevantEdges)
      } else {
        setEdges(undefined)
      }
    } catch (error) {
      console.error('[explore] Search error:', error)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="flex items-center justify-between px-4 py-2.5 border-b">
        <ViewSelector value={view} onValueChange={setView} />
        <div className="flex items-center gap-1.5">
          <ExtractControl extraction={extraction} compact />
          <ThemeToggle />
          <DeleteDatabaseButton />
        </div>
      </header>

      <StatsBar status={extraction.status} />

      <div className="flex-1 overflow-hidden relative">
        {view === 'explore' ? (
          <>
            <div className="absolute inset-0">
              <StarMap topics={topics} highlightedTopics={highlightedTopics} edges={edges} />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none">
              <div className="pointer-events-auto">
                <ExploreInput onSearch={handleSearch} isSearching={isSearching} />
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Inspect View
          </div>
        )}
      </div>
    </div>
  )
}
