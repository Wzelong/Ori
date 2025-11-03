import { useState, useEffect } from 'react'
import { ExtractControl } from '@/popup/components/ExtractControl'
import { useExtraction } from '@/hooks/useExtraction'
import { ViewSelector } from './components/ViewSelector'
import { DeleteDatabaseButton } from './components/DeleteDatabaseButton'
import { ThemeToggle } from './components/ThemeToggle'
import { StatsBar } from './components/StatsBar'
import { ExploreInput } from './components/ExploreInput'
import { ItemCard } from './components/ItemCard'
import { InspectView } from './components/InspectView'
import { InsightStream } from './components/InsightStream'
import { StarMap } from '@/components/StarMap'
import { db } from '@/db/database'
import type { TopicWithPosition, TopicEdge, Item } from '@/types/schema'
import type { TopicSearchResult } from '@/services/search'
import { getItemsForTopic } from '@/services/graph'
import { performRAGSearch } from '@/services/searchOrchestrator'

export default function App() {
  const extraction = useExtraction()
  const [view, setView] = useState<'explore' | 'inspect'>('explore')
  const [topics, setTopics] = useState<TopicWithPosition[]>([])
  const [highlightedTopics, setHighlightedTopics] = useState<TopicSearchResult[] | undefined>()
  const [edges, setEdges] = useState<TopicEdge[] | undefined>()
  const [selectedTopic, setSelectedTopic] = useState<TopicWithPosition | null>(null)
  const [topicItems, setTopicItems] = useState<Item[]>([])
  const [insightStream, setInsightStream] = useState<ReadableStream<string> | null>(null)
  const [insightItemMap, setInsightItemMap] = useState<Map<string, string>>(new Map())
  const [isWaitingForInsight, setIsWaitingForInsight] = useState(false)

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

    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.lastInsertionTime) {
        loadTopics()
      }
    }

    chrome.storage.onChanged.addListener(listener)
    return () => {
      clearInterval(interval)
      chrome.storage.onChanged.removeListener(listener)
    }
  }, [])

  useEffect(() => {
    if (highlightedTopics && highlightedTopics.length > 0) {
      handleClear()
    }
  }, [topics.length])

  useEffect(() => {
    if (view === 'explore' && highlightedTopics && highlightedTopics.length > 0) {
      handleClear()
    }
  }, [view])

  const handleSearch = async (query: string) => {
    try {
      setIsWaitingForInsight(true)

      const response = await chrome.runtime.sendMessage({
        type: 'GET_EMBEDDING',
        text: query,
        format: 'query'
      })

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to get embedding')
      }

      const result = await performRAGSearch(response.embedding, query, topics)

      setHighlightedTopics(result.highlightedTopics)
      setEdges(result.edges)
      setInsightStream(result.insightStream)
      setInsightItemMap(result.itemMap)
    } catch (error) {
      console.error('[explore] Search error:', error)
    }
  }

  const handleClear = () => {
    setHighlightedTopics(undefined)
    setEdges(undefined)
    setInsightStream(null)
    setInsightItemMap(new Map())
    setIsWaitingForInsight(false)
  }

  const handleCloseInsight = () => {
    setInsightStream(null)
    setInsightItemMap(new Map())
    setIsWaitingForInsight(false)
  }

  const handleTopicClick = async (topic: TopicWithPosition) => {
    setSelectedTopic(topic)
    const items = await getItemsForTopic(topic.id)
    setTopicItems(items)
  }

  const handleCloseCard = () => {
    setSelectedTopic(null)
    setTopicItems([])
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
              <StarMap
                topics={topics}
                highlightedTopics={highlightedTopics}
                edges={edges}
                onTopicClick={handleTopicClick}
              />
            </div>
            {(isWaitingForInsight || insightStream) && (
              <div className="absolute top-0 left-0 right-0 z-[9998]">
                <InsightStream
                  stream={insightStream}
                  isWaiting={isWaitingForInsight}
                  itemMap={insightItemMap}
                  onClose={handleCloseInsight}
                  onComplete={() => setIsWaitingForInsight(false)}
                />
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 p-4 pointer-events-none flex flex-col-reverse gap-3 z-[9999]">
              <div className="pointer-events-auto">
                <ExploreInput
                  onSearch={handleSearch}
                  onInputChange={handleClear}
                  isSearching={false}
                  hasResults={highlightedTopics !== undefined && highlightedTopics.length > 0}
                />
              </div>
              {selectedTopic && (
                <div className="pointer-events-auto">
                  <ItemCard
                    topic={selectedTopic}
                    items={topicItems}
                    onClose={handleCloseCard}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <InspectView />
        )}
      </div>
    </div>
  )
}
